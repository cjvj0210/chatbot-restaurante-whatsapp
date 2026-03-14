import type { Request, Response } from "express";
import { processIncomingMessage } from "./chatbot";
import { sendTextMessageEvolution, deleteMessageForEveryone, sendTextMessageEvolutionWithId } from "./evolutionApi";
import { whatsappService } from "./services/whatsappService";
import { markMessageAsProcessed } from "./messagePolling";
import { isBotSentMessage } from "./botMessageTracker";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { transcribeFromEvolution } from "./services/audioService";
import { activateHumanModeForJid, deactivateHumanModeForJid, isHumanModeActiveForJid } from "./services/humanModeService";
import { CHATBOT } from "../shared/constants";
import { logger } from "./utils/logger";

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

/** Comandos que o operador pode enviar para reativar o bot (verificados em fromMe=true) */
const BOT_COMMANDS = new Set(["#bot", "#ativar", "#reativar"]);

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
const WEBHOOK_DEDUP_WINDOW_MS = CHATBOT.WEBHOOK_DEDUP_WINDOW_MS;

// Limpeza periódica de entradas expiradas a cada 60 segundos
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of Array.from(recentWebhookEvents.entries())) {
    if (now - ts > WEBHOOK_DEDUP_WINDOW_MS) recentWebhookEvents.delete(id);
  }
}, 60_000);

function isWebhookDuplicate(messageId: string): boolean {
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
      logger.warn("Webhook", "apikey inválida ou ausente — payload rejeitado");
      return;
    }

    const timestamp = new Date().toISOString();
    logger.info("Webhook", `[${timestamp}] Evento: ${payload.event} | Instância: ${payload.instance}`);

    // Tratar evento de conexão (detectar desconexão em tempo real)
    const eventNormalized = payload.event?.toUpperCase().replace(".", "_");
    if (eventNormalized === "CONNECTION_UPDATE") {
      const state = (payload.data as any)?.state || (payload.data as any)?.status;
      logger.info("Webhook", `Conexão atualizada: ${JSON.stringify(payload.data)}`);
      if (state === "close" || state === "disconnected") {
        logger.error("Webhook", "⚠️ DESCONEXÃO DETECTADA via webhook!", state);
      }
      return;
    }

    // Só processar evento de mensagens recebidas
    if (eventNormalized !== "MESSAGES_UPSERT") {
      logger.info("Webhook", `Evento ignorado: ${payload.event}`);
      return;
    }

    const { key, message, messageType, pushName } = payload.data;

    // ===== DEDUPLICAÇÃO NO WEBHOOK =====
    // A Evolution API pode enviar múltiplos eventos MESSAGES_UPSERT para a mesma mensagem
    const webhookMsgId = key.id;
    if (webhookMsgId && isWebhookDuplicate(webhookMsgId)) {
      logger.info("Webhook", `⚠️ Evento duplicado ignorado: ${webhookMsgId}`);
      return;
    }

    // Mensagens fromMe=true: verificar se foi o BOT ou o OPERADOR
    if (key.fromMe) {
      const messageId = key.id;

      // Se o ID está registrado no tracker, foi o BOT que enviou → ignorar
      if (await isBotSentMessage(messageId)) {
        logger.info("Webhook", `Mensagem do BOT detectada (ID registrado): ${messageId}`);
        return;
      }

      // Se o ID NÃO está registrado, foi o OPERADOR que digitou manualmente
      logger.info("Webhook", `Mensagem do OPERADOR detectada (ID não registrado): ${messageId}`);

      // Extrair texto da mensagem do operador
      const operatorMsg = payload.data.message?.conversation || payload.data.message?.extendedTextMessage?.text || "";

      // Aceitar variações do comando para reativar o bot
      const normalizedCmd = operatorMsg.trim().toLowerCase();
      if (BOT_COMMANDS.has(normalizedCmd)) {
        logger.info("Webhook", `Comando ${normalizedCmd} recebido — apagando mensagem e reativando bot`);

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
      logger.info("Webhook", `Mensagem de grupo/status ignorada: ${key.remoteJid}`);
      return;
    }

    // Verificar se é conversa individual válida
    if (!isIndividualChat(key.remoteJid)) {
      logger.info("Webhook", `JID não reconhecido, tentando processar mesmo assim: ${key.remoteJid}`);
    }

    const phone = phoneNormalizer.normalize(key.remoteJid);
    const whatsappId = key.remoteJid; // Usar JID completo como ID único
    const messageId = key.id;
    // Extrair número real do telefone quando JID é @lid (via remoteJidAlt)
    const remoteJidAlt = key.remoteJidAlt || undefined;
    const realPhone = remoteJidAlt ? phoneNormalizer.normalize(remoteJidAlt) : undefined;

    logger.info("Webhook", `Mensagem de ${phone} (${pushName || "sem nome"}) | Tipo: ${messageType} | realPhone: ${realPhone || 'N/A'}`);

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
      logger.info("Webhook", `Áudio recebido, transcrevendo... ID: ${messageId}`);
      const transcription = await transcribeFromEvolution(messageId);
      if (transcription) {
        messageText = transcription;
        logger.info("Webhook", `Áudio transcrito: "${messageText}"`);
      } else {
        messageText = "[Áudio recebido - não foi possível transcrever]";
      }
    } else if (message?.stickerMessage) {
      logger.info("Webhook", "Sticker ignorado");
      return;
    } else {
      logger.info("Webhook", `Tipo de mensagem não suportado: ${messageType}`);
      return;
    }

    // Validar e sanitizar messageText antes de processar
    const safeText = typeof messageText === "string" ? messageText.slice(0, 2000) : "";
    if (!safeText.trim()) {
      logger.info("Webhook", "Mensagem vazia ou inválida, ignorando");
      return;
    }
    messageText = safeText;

    logger.info("Webhook", `Processando: "${messageText.substring(0, 100)}..."`);

    // Marcar como processada para que o polling não reprocesse
    markMessageAsProcessed(messageId);

    // Processar mensagem pelo chatbot (passar pushName e realPhone para enriquecer dados do cliente)
    await processIncomingMessage(whatsappId, phone, messageText, messageId, pushName || undefined, realPhone);

    logger.info("Webhook", "Mensagem processada com sucesso");
  } catch (error) {
    logger.error("Webhook", "Erro ao processar webhook:", error);
  }
}


/**
 * Envia uma mensagem de texto e retorna o ID da mensagem enviada.
 * Usado para enviar notificações que serão apagadas depois.
 */
async function sendTextAndGetId(remoteJid: string, text: string): Promise<string | null> {
  return sendTextMessageEvolutionWithId(remoteJid, text);
}

