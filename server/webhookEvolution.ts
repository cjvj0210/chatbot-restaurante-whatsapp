import type { Request, Response } from "express";
import { processIncomingMessage } from "./chatbot";
import { sendTextMessageEvolution, downloadMediaEvolution } from "./evolutionApi";
import { markMessageAsProcessed } from "./messagePolling";
import { isBotSentMessage } from "./botMessageTracker";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { getDb, getCustomerByWhatsappId, getActiveConversation, updateConversation } from "./db";
import { conversations, customers } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

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
  return jid.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@g.us", "").replace(/\D/g, "");
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
 * Endpoint POST - Recebe eventos da Evolution API
 */
export async function handleEvolutionWebhook(req: Request, res: Response): Promise<void> {
  // Responder imediatamente para não dar timeout na Evolution API
  res.status(200).send("OK");

  try {
    const payload = req.body as EvolutionWebhookPayload;

    // Validar autenticidade do webhook: verificar apikey enviada pela Evolution API
    const configuredKey = process.env.EVOLUTION_API_KEY || "";
    const receivedKey = payload.apikey || (req.headers["apikey"] as string) || "";
    if (configuredKey && receivedKey && receivedKey !== configuredKey) {
      console.warn("[EvolutionWebhook] apikey inválida — payload ignorado");
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

    // Mensagens fromMe=true: verificar se foi o BOT ou o OPERADOR
    if (key.fromMe) {
      const messageId = key.id;
      
      // Se o ID está registrado no tracker, foi o BOT que enviou → ignorar
      if (isBotSentMessage(messageId)) {
        console.log(`[EvolutionWebhook] Mensagem do BOT detectada (ID registrado): ${messageId}`);
        return;
      }
      
      // Se o ID NÃO está registrado, foi o OPERADOR que digitou manualmente → ativar modo humano
      console.log(`[EvolutionWebhook] Mensagem do OPERADOR detectada (ID não registrado): ${messageId}`);
      
      // Verificar se o operador enviou o comando "bot" para desativar modo humano
      const msgText = payload.data.message?.conversation || payload.data.message?.extendedTextMessage?.text || "";
      if (msgText.trim().toLowerCase() === "bot") {
        console.log(`[EvolutionWebhook] Comando 'bot' recebido — desativando modo humano`);
        await deactivateHumanModeForJid(key.remoteJid);
        return;
      }
      
      // Ativar modo humano para esta conversa (30 minutos)
      await activateHumanModeForJid(key.remoteJid);
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

    console.log(`[EvolutionWebhook] Mensagem de ${phone} (${pushName || "sem nome"}) | Tipo: ${messageType}`);

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
      const transcription = await transcribeEvolutionAudio(messageId);
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

    // Processar mensagem pelo chatbot
    await processIncomingMessage(whatsappId, phone, messageText, messageId);

    console.log(`[EvolutionWebhook] Mensagem processada com sucesso`);
  } catch (error) {
    console.error("[EvolutionWebhook] Erro ao processar webhook:", error);
  }
}

/**
 * Transcreve um áudio recebido via Evolution API usando Whisper
 * Fluxo: Evolution API (base64) → S3 (URL pública) → Whisper (transcrição)
 */
async function transcribeEvolutionAudio(messageId: string): Promise<string | null> {
  try {
    // 1. Baixar o áudio em base64 via Evolution API
    const audioBuffer = await downloadMediaEvolution(messageId);

    if (!audioBuffer) {
      console.error("[EvolutionWebhook] Falha ao baixar áudio");
      return null;
    }

    console.log(`[EvolutionWebhook] Áudio baixado: ${audioBuffer.length} bytes`);

    // 2. Fazer upload para S3 para obter URL pública acessível pelo Whisper
    // O Whisper precisa de URL HTTP, não aceita arquivo local
    const s3Key = `audio-transcriptions/${messageId}-${Date.now()}.ogg`;
    let audioUrl: string;
    try {
      const uploaded = await storagePut(s3Key, audioBuffer, "audio/ogg");
      audioUrl = uploaded.url;
      console.log(`[EvolutionWebhook] Áudio enviado para S3: ${audioUrl}`);
    } catch (uploadErr) {
      console.error("[EvolutionWebhook] Falha ao enviar áudio para S3:", uploadErr);
      return null;
    }

    // 3. Transcrever com Whisper usando a URL do S3
    const result = await transcribeAudio({
      audioUrl,
      language: "pt",
      prompt: "Transcrição de mensagem de voz em português brasileiro para atendimento de restaurante",
    });

    if ("error" in result) {
      console.error("[EvolutionWebhook] Erro na transcrição:", result.error, result.details);
      return null;
    }

    const transcribed = result?.text?.trim() || null;
    console.log(`[EvolutionWebhook] Transcrição concluída: "${transcribed}"`);
    return transcribed;
  } catch (error) {
    console.error("[EvolutionWebhook] Erro ao transcrever áudio:", error);
    return null;
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
    console.log(`[EvolutionWebhook] Bot ficará silencioso. Operador pode enviar "bot" para reativar.`);
  } catch (err) {
    console.error("[EvolutionWebhook] Erro ao ativar modo humano:", err);
  }
}

/**
 * Desativa o modo humano para uma conversa baseada no JID do WhatsApp.
 * Chamada quando o operador envia o comando "bot".
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
