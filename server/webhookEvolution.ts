import type { Request, Response } from "express";
import { processIncomingMessage } from "./chatbot";
import { sendTextMessageEvolution, deleteMessageForEveryone } from "./evolutionApi";
import { whatsappService } from "./services/whatsappService";
import { markMessageAsProcessed } from "./messagePolling";
import { isBotSentMessage } from "./botMessageTracker";
import { getDb, getCustomerByWhatsappId, getActiveConversation, updateConversation } from "./db";
import { conversations, customers } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { transcribeFromEvolution } from "./services/audioService";

/**
 * Estrutura do payload de webhook da Evolution API v2.3.7
 * Evento: MESSAGES_UPSERT
 */
interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
      remoteJidAlt?: string; // Número real quando JID é @lid (ex: 5517988112791@s.whatsapp.net)
      addressingMode?: string; // "lid" quando usa Linked ID
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
        seconds?: number;
        ptt?: boolean;
        fileLength?: string;
      };
      imageMessage?: {
        caption?: string;
        url?: string;
        mimetype?: string;
      };
      documentMessage?: {
        caption?: string;
        fileName?: string;
      };
      stickerMessage?: object;
      reactionMessage?: {
        text: string;
      };
      buttonsResponseMessage?: {
        selectedButtonId: string;
        selectedDisplayText: string;
      };
      listResponseMessage?: {
        singleSelectReply: {
          selectedRowId: string;
        };
        title: string;
      };
    };
    messageType?: string;
    messageTimestamp?: number;
    instanceId?: string;
    source?: string;
  };
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

/**
 * Extrai o número de telefone do JID do WhatsApp
 * Suporta formatos:
 *   - "5517999999999@s.whatsapp.net" → "5517999999999"
 *   - "212454869074102@lid" → "212454869074102" (Linked ID)
 */
function extractPhoneFromJid(jid: string): string {
  return phoneNormalizer.normalize(jid);
}

/**
 * Verifica se o JID é de uma conversa individual (não grupo/status)
 * Aceita tanto @s.whatsapp.net quanto @lid (Linked ID)
 */
function isIndividualChat(jid: string): boolean {
  return (
    jid.endsWith("@s.whatsapp.net") ||
    jid.endsWith("@lid")
  );
}

/**
 * Verifica se o JID é de grupo
 */
function isGroupChat(jid: string): boolean {
  return jid.includes("@g.us");
}

/**
 * Verifica se o JID é de status/broadcast (deve ser ignorado)
 */
function isStatusBroadcast(jid: string): boolean {
  return jid === "status@broadcast" || jid.includes("status");
}

/**
 * Deduplicação de eventos no webhook.
 * A Evolution API pode enviar múltiplos eventos MESSAGES_UPSERT para a mesma mensagem.
 */
const recentWebhookEvents = new Map<string, number>();
const WEBHOOK_DEDUP_WINDOW_MS = 30_000; // 30 segundos
const MAX_WEBHOOK_DEDUP = 500;

function isWebhookDuplicate(messageId: string): boolean {
  // Limpar entradas antigas
  if (recentWebhookEvents.size > MAX_WEBHOOK_DEDUP) {
    const now = Date.now();
    Array.from(recentWebhookEvents.entries()).forEach(([id, ts]) => {
      if (now - ts > WEBHOOK_DEDUP_WINDOW_MS) {
        recentWebhookEvents.delete(id);
      }
    });
  }
  if (recentWebhookEvents.has(messageId)) {
    return true;
  }
  recentWebhookEvents.set(messageId, Date.now());
  return false;
}

/**
 * Endpoint POST - Recebe eventos da Evolution API
 */
export async function handleEvolutionWebhook(req: Request, res: Response): Promise<void> {
  // Responder imediatamente para não dar timeout na Evolution API
  res.status(200).send("OK");

  try {
    const payload = req.body as EvolutionWebhookPayload;

    // Validar autenticidade do webhook: verificar apikey enviada pela Evolution API
    // SEGURANÇA: fail-closed — rejeitar se chave ausente OU inválida (nunca fail-open)
    const configuredKey = process.env.EVOLUTION_API_KEY || "";
    const receivedKey = payload.apikey || (req.headers["apikey"] as string) || "";
    if (!receivedKey || receivedKey !== configuredKey) {
      console.warn("[EvolutionWebhook] apikey inválida ou ausente — payload rejeitado");
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[EvolutionWebhook] [${timestamp}] Evento: ${payload.event} | Instância: ${payload.instance}`);

    // Tratar evento de conexão (detectar desconexão em tempo real)
    const eventNormalized = payload.event?.toUpperCase().replace(".", "_");
    if (eventNormalized === "CONNECTION_UPDATE") {
      const state = (payload.data as any)?.state || (payload.data as any)?.status;
      console.log(`[EvolutionWebhook] Conexão atualizada: ${JSON.stringify(payload.data)}`);
      if (state === "close" || state === "disconnected") {
        console.error(`[EvolutionWebhook] ⚠️ DESCONEXÃO DETECTADA via webhook!`);
      }
      return;
    }

    // Só processar evento de mensagens recebidas
    if (eventNormalized !== "MESSAGES_UPSERT") {
      console.log(`[EvolutionWebhook] Evento ignorado: ${payload.event}`);
      return;
    }

    const { key, message, messageType, pushName } = payload.data;

    // ===== DEDUPLICAÇÃO NO WEBHOOK =====
    // A Evolution API pode enviar múltiplos eventos MESSAGES_UPSERT para a mesma mensagem
    const webhookMsgId = key.id;
    if (webhookMsgId && isWebhookDuplicate(webhookMsgId)) {
      console.log(`[EvolutionWebhook] ⚠️ Evento duplicado ignorado: ${webhookMsgId}`);
      return;
    }

    // Mensagens fromMe=true: verificar se foi o BOT ou o OPERADOR
    if (key.fromMe) {
      const messageId = key.id;
      
      // Se o ID está registrado no tracker, foi o BOT que enviou → ignorar
      if (await isBotSentMessage(messageId)) {
        console.log(`[EvolutionWebhook] Mensagem do BOT detectada (ID registrado): ${messageId}`);
        return;
      }
      
      // Se o ID NÃO está registrado, foi o OPERADOR que digitou manualmente
      console.log(`[EvolutionWebhook] Mensagem do OPERADOR detectada (ID não registrado): ${messageId}`);
      
      // Extrair texto da mensagem do operador
      const operatorMsg = payload.data.message?.conversation || payload.data.message?.extendedTextMessage?.text || "";
      
      // Verificar se é o comando #bot (devolver ao bot)
      if (operatorMsg.trim().toLowerCase() === "#bot") {
        console.log(`[EvolutionWebhook] Comando #bot recebido — apagando mensagem e reativando bot`);
        
        // 1. Apagar a mensagem #bot antes do cliente ver
        await deleteMessageForEveryone(key.remoteJid, messageId, true);
        
        // 2. Desativar modo humano
        await deactivateHumanModeForJid(key.remoteJid);
        
        // 3. Enviar confirmação silenciosa ao operador (mensagem que se auto-apaga)
        // Enviamos uma confirmação e apagamos em 3 segundos
        const confirmMsg = await sendTextAndGetId(key.remoteJid, "✅ Bot reativado para esta conversa!");
        if (confirmMsg) {
          setTimeout(async () => {
            await deleteMessageForEveryone(key.remoteJid, confirmMsg, true);
          }, 3000);
        }
        return;
      }
      
      // Qualquer outra mensagem do operador → ativar modo humano (30 min)
      // Verificar se já está em modo humano para não enviar notificação repetida
      const isAlreadyHuman = await isHumanModeActiveForJid(key.remoteJid);
      await activateHumanModeForJid(key.remoteJid);
      
      if (!isAlreadyHuman) {
        // Primeira mensagem do operador: enviar notificação silenciosa
        const notifMsg = await sendTextAndGetId(
          key.remoteJid,
          "👤 Modo humano ativado (30 min). O bot está pausado.\nEnvie #bot para devolver ao atendimento automático."
        );
        // Apagar a notificação após 5 segundos (operador vê, cliente não)
        if (notifMsg) {
          setTimeout(async () => {
            await deleteMessageForEveryone(key.remoteJid, notifMsg, true);
          }, 5000);
        }
      }
      return;
    }

    // Ignorar mensagens de grupos e status/broadcast
    if (isGroupChat(key.remoteJid) || isStatusBroadcast(key.remoteJid)) {
      console.log(`[EvolutionWebhook] Mensagem de grupo/status ignorada: ${key.remoteJid}`);
      return;
    }

    // Verificar se é conversa individual válida
    if (!isIndividualChat(key.remoteJid)) {
      console.log(`[EvolutionWebhook] JID não reconhecido, tentando processar mesmo assim: ${key.remoteJid}`);
    }

    const phone = extractPhoneFromJid(key.remoteJid);
    const whatsappId = key.remoteJid; // Usar JID completo como ID único
    const messageId = key.id;
    // Extrair número real do telefone quando JID é @lid (via remoteJidAlt)
    const remoteJidAlt = key.remoteJidAlt || undefined;
    const realPhone = remoteJidAlt ? phoneNormalizer.normalize(remoteJidAlt) : undefined;

    console.log(`[EvolutionWebhook] Mensagem de ${phone} (${pushName || "sem nome"}) | Tipo: ${messageType} | realPhone: ${realPhone || 'N/A'}`);

    let messageText = "";

    // Extrair texto da mensagem conforme o tipo
    if (message?.conversation) {
      messageText = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      messageText = message.extendedTextMessage.text;
    } else if (message?.buttonsResponseMessage?.selectedDisplayText) {
      messageText = message.buttonsResponseMessage.selectedDisplayText;
    } else if (message?.listResponseMessage?.title) {
      messageText = message.listResponseMessage.title;
    } else if (message?.imageMessage?.caption) {
      messageText = message.imageMessage.caption || "[Imagem enviada]";
    } else if (message?.audioMessage || messageType === "audioMessage" || messageType === "pttMessage") {
      // Processar áudio: baixar e transcrever
      console.log(`[EvolutionWebhook] Áudio recebido, transcrevendo... ID: ${messageId}`);
      const transcription = await transcribeFromEvolution(messageId);
      if (transcription) {
        messageText = transcription;
        console.log(`[EvolutionWebhook] Áudio transcrito: "${messageText}"`);
      } else {
        messageText = "[Áudio recebido - não foi possível transcrever]";
      }
    } else if (message?.stickerMessage) {
      console.log("[EvolutionWebhook] Sticker ignorado");
      return;
    } else {
      console.log(`[EvolutionWebhook] Tipo de mensagem não suportado: ${messageType}`);
      return;
    }

    if (!messageText.trim()) {
      console.log("[EvolutionWebhook] Mensagem vazia, ignorando");
      return;
    }

    console.log(`[EvolutionWebhook] Processando: "${messageText.substring(0, 100)}..."`);

    // Marcar como processada para que o polling não reprocesse
    markMessageAsProcessed(messageId);

    // Processar mensagem pelo chatbot (passar pushName e realPhone para enriquecer dados do cliente)
    await processIncomingMessage(whatsappId, phone, messageText, messageId, pushName || undefined, realPhone);

    console.log(`[EvolutionWebhook] Mensagem processada com sucesso`);
  } catch (error) {
    console.error("[EvolutionWebhook] Erro ao processar webhook:", error);
  }
}

/**
 * Ativa o modo humano para uma conversa baseada no JID do WhatsApp.
 * Quando o operador responde manualmente, o bot fica silencioso por 30 minutos.
 */
async function activateHumanModeForJid(remoteJid: string): Promise<void> {
  try {
    const phone = extractPhoneFromJid(remoteJid);
    const customer = await getCustomerByWhatsappId(remoteJid);
    
    if (!customer) {
      console.log(`[EvolutionWebhook] Cliente não encontrado para ${phone} — modo humano não ativado`);
      return;
    }
    
    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      console.log(`[EvolutionWebhook] Conversa ativa não encontrada para ${phone} — modo humano não ativado`);
      return;
    }
    
    const humanModeUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
    await updateConversation(conversation.id, {
      humanMode: true,
      humanModeUntil,
    });
    
    console.log(`[EvolutionWebhook] ✅ Modo humano ATIVADO para ${phone} até ${humanModeUntil.toISOString()}`);
    console.log(`[EvolutionWebhook] Bot ficará silencioso. Operador pode enviar #bot para reativar.`);
  } catch (err) {
    console.error("[EvolutionWebhook] Erro ao ativar modo humano:", err);
  }
}

/**
 * Desativa o modo humano para uma conversa baseada no JID do WhatsApp.
 * Chamada quando o operador envia o comando #bot.
 */
async function deactivateHumanModeForJid(remoteJid: string): Promise<void> {
  try {
    const phone = extractPhoneFromJid(remoteJid);
    const customer = await getCustomerByWhatsappId(remoteJid);
    
    if (!customer) {
      console.log(`[EvolutionWebhook] Cliente não encontrado para ${phone}`);
      return;
    }
    
    const conversation = await getActiveConversation(customer.id);
    if (!conversation) {
      console.log(`[EvolutionWebhook] Conversa ativa não encontrada para ${phone}`);
      return;
    }
    
    await updateConversation(conversation.id, {
      humanMode: false,
      humanModeUntil: null,
    });
    
    console.log(`[EvolutionWebhook] ✅ Modo humano DESATIVADO para ${phone} — bot retomando atendimento`);
  } catch (err) {
    console.error("[EvolutionWebhook] Erro ao desativar modo humano:", err);
  }
}

/**
 * Envia uma mensagem de texto e retorna o ID da mensagem enviada.
 * Usado para enviar notificações que serão apagadas depois.
 */
async function sendTextAndGetId(remoteJid: string, text: string): Promise<string | null> {
  try {
    const axios = (await import("axios")).default;
    const baseUrl = process.env.EVOLUTION_API_URL || "";
    const apiKey = process.env.EVOLUTION_API_KEY || "";
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "teste";

    if (!baseUrl || !apiKey) return null;

    const isLid = remoteJid.endsWith("@lid");
    const normalizedTo = isLid ? remoteJid : remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    const response = await axios.post(
      `${baseUrl}/message/sendText/${instanceName}`,
      { number: normalizedTo, text },
      {
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        timeout: 15000,
      }
    );

    const sentId = response.data?.key?.id;
    if (sentId) {
      // Registrar no tracker para que o webhook não trate como mensagem do operador
      const { registerBotSentMessage } = await import("./botMessageTracker");
      await registerBotSentMessage(sentId);
    }
    return sentId || null;
  } catch (error: any) {
    console.error("[EvolutionWebhook] Erro ao enviar mensagem silenciosa:", error?.message);
    return null;
  }
}

/**
 * Verifica se o modo humano está ativo para uma conversa baseada no JID.
 * Retorna true se o modo humano está ativo e ainda não expirou.
 */
async function isHumanModeActiveForJid(remoteJid: string): Promise<boolean> {
  try {
    const customer = await getCustomerByWhatsappId(remoteJid);
    if (!customer) return false;

    const conversation = await getActiveConversation(customer.id);
    if (!conversation) return false;

    if (!conversation.humanMode) return false;

    // Verificar se ainda não expirou
    if (conversation.humanModeUntil) {
      const until = new Date(conversation.humanModeUntil);
      if (until > new Date()) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("[EvolutionWebhook] Erro ao verificar modo humano:", err);
    return false;
  }
}
