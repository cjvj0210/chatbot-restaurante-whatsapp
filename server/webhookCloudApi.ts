import type { Request, Response } from "express";
import { processIncomingMessage, resumeConversationAfterBot } from "./chatbot";
import {
  sendTextMessageCloudApiWithId,
  markMessageAsReadCloudApi,
  transcribeAudioCloudApi,
} from "./cloudApi";
import { whatsappService } from "./services/whatsappService";
import { isBotSentMessage } from "./botMessageTracker";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import {
  activateHumanModeForJid,
  deactivateHumanModeForJid,
  isHumanModeActiveForJid,
} from "./services/humanModeService";
import { CHATBOT } from "../shared/constants";
import { logger } from "./utils/logger";

/**
 * Webhook da Meta Cloud API para WhatsApp Business Platform
 *
 * Formato do payload:
 * {
 *   object: "whatsapp_business_account",
 *   entry: [{
 *     id: "WABA_ID",
 *     changes: [{
 *       value: {
 *         messaging_product: "whatsapp",
 *         metadata: { display_phone_number, phone_number_id },
 *         contacts: [{ profile: { name }, wa_id }],
 *         messages: [{ from, id, timestamp, type, text?, audio?, image?, interactive? }],
 *         statuses: [{ id, status, timestamp, recipient_id }]
 *       },
 *       field: "messages"
 *     }]
 *   }]
 * }
 */

/** Comandos que o operador pode enviar para reativar o bot */
const BOT_COMMANDS = new Set(["#bot", "#ativar", "#reativar"]);

/** Deduplicação de eventos no webhook */
const recentWebhookEvents = new Map<string, number>();
const WEBHOOK_DEDUP_WINDOW_MS = CHATBOT.WEBHOOK_DEDUP_WINDOW_MS;

// Limpeza periódica
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of Array.from(recentWebhookEvents.entries())) {
    if (now - ts > WEBHOOK_DEDUP_WINDOW_MS) recentWebhookEvents.delete(id);
  }
}, 60_000);

function isWebhookDuplicate(messageId: string): boolean {
  if (recentWebhookEvents.has(messageId)) return true;
  recentWebhookEvents.set(messageId, Date.now());
  return false;
}

/**
 * GET /api/webhook/cloud — Verificação do webhook pela Meta
 * A Meta envia um GET com hub.mode, hub.verify_token e hub.challenge
 */
export async function handleCloudApiWebhookVerification(req: Request, res: Response): Promise<void> {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "";

  logger.info("CloudWebhook", `Verificação recebida: mode=${mode} token=${token ? "***" : "vazio"}`);

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("CloudWebhook", "Webhook verificado com sucesso");
    res.status(200).send(challenge);
  } else {
    logger.error("CloudWebhook", "Verificação falhou", { mode, expectedToken: verifyToken ? "SET" : "NOT_SET" });
    res.status(403).send("Verification failed");
  }
}

/**
 * POST /api/webhook/cloud — Recebimento de mensagens da Cloud API
 */
export async function handleCloudApiWebhookMessage(req: Request, res: Response): Promise<void> {
  // Responder imediatamente (Meta exige resposta em < 5 segundos)
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      logger.info("CloudWebhook", `Objeto ignorado: ${body.object}`);
      return;
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        if (!value) continue;

        // ===== PROCESSAR STATUS DE MENSAGENS =====
        if (value.statuses) {
          for (const status of value.statuses) {
            logger.debug("CloudWebhook", `Status: ${status.id} → ${status.status}`);
          }
        }

        // ===== PROCESSAR MENSAGENS RECEBIDAS =====
        if (!value.messages || value.messages.length === 0) continue;

        const contacts = value.contacts || [];

        for (const message of value.messages) {
          const from = message.from; // Número do remetente (ex: 5517988112791)
          const messageId = message.id; // wamid.xxx
          const timestamp = message.timestamp;
          const pushName = contacts[0]?.profile?.name || "";

          // Deduplicação
          if (messageId && isWebhookDuplicate(messageId)) {
            logger.info("CloudWebhook", `Evento duplicado ignorado: ${messageId}`);
            continue;
          }

          // Na Cloud API, todas as mensagens recebidas são de clientes (não há fromMe)
          // Mensagens do bot são enviadas via API e não geram webhook
          logger.info("CloudWebhook", `Mensagem de ${from} (${pushName}) | Tipo: ${message.type} | ID: ${messageId}`);

          let messageText = "";

          // Extrair texto conforme o tipo
          if (message.type === "text" && message.text?.body) {
            messageText = message.text.body;
          } else if (message.type === "interactive") {
            if (message.interactive?.button_reply) {
              messageText = message.interactive.button_reply.title;
            } else if (message.interactive?.list_reply) {
              messageText = message.interactive.list_reply.title;
            }
          } else if (message.type === "image" && message.image?.caption) {
            messageText = message.image.caption;
          } else if (message.type === "audio" || message.type === "voice") {
            // Transcrever áudio
            const audioId = message.audio?.id || message.voice?.id;
            if (audioId) {
              logger.info("CloudWebhook", `Áudio recebido, transcrevendo... mediaId: ${audioId}`);
              const transcription = await transcribeAudioCloudApi(audioId);
              if (transcription) {
                messageText = transcription;
                logger.info("CloudWebhook", `Áudio transcrito: "${messageText.substring(0, 80)}"`);
              } else {
                messageText = "[Áudio recebido - não foi possível transcrever]";
              }
            }
          } else if (message.type === "sticker" || message.type === "reaction") {
            logger.info("CloudWebhook", `${message.type} ignorado`);
            continue;
          } else {
            logger.info("CloudWebhook", `Tipo não suportado: ${message.type}`);
            continue;
          }

          // Validar e sanitizar
          const safeText = typeof messageText === "string" ? messageText.slice(0, 2000) : "";
          if (!safeText.trim()) {
            logger.info("CloudWebhook", "Mensagem vazia ou inválida, ignorando");
            continue;
          }

          // Marcar como lida
          markMessageAsReadCloudApi(messageId).catch(() => {});

          // Na Cloud API, o "whatsappId" é o número do remetente (ex: 5517988112791)
          // Não há JID @s.whatsapp.net ou @lid — é apenas o número
          const phone = phoneNormalizer.normalize(from);
          const whatsappId = from; // Usar número como ID

          logger.info("CloudWebhook", `Processando: "${safeText.substring(0, 100)}..."`);

          // Processar mensagem pelo chatbot
          await processIncomingMessage(whatsappId, phone, safeText, messageId, pushName || undefined);

          logger.info("CloudWebhook", "Mensagem processada com sucesso");
        }
      }
    }
  } catch (error) {
    logger.error("CloudWebhook", "Erro ao processar webhook:", error);
  }
}
