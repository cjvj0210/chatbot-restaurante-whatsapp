import type { Request, Response } from "express";
import crypto from "crypto";
import { processIncomingMessage } from "./chatbot";
import { markMessageAsReadYCloud } from "./ycloudApi";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { CHATBOT } from "../shared/constants";
import { logger } from "./utils/logger";

/**
 * Webhook handler para YCloud (BSP do WhatsApp)
 *
 * Formato do payload YCloud (whatsapp.inbound_message.received):
 * {
 *   id: "evt_xxx",
 *   type: "whatsapp.inbound_message.received",
 *   apiVersion: "v2",
 *   createTime: "2022-03-01T12:00:00.000Z",
 *   whatsappInboundMessage: {
 *     id: "wim123456",
 *     wabaId: "whatsapp-business-account-id",
 *     from: "+5517988112791",
 *     customerProfile: { name: "John" },
 *     to: "+5517992253886",
 *     sendTime: "2022-03-01T12:00:00.000Z",
 *     type: "text",
 *     text: { body: "Olá!" }
 *   }
 * }
 *
 * Tipos suportados: text, image, audio, video, interactive, sticker, reaction
 */

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
 * Valida a assinatura HMAC do webhook YCloud.
 * O YCloud assina o body com HMAC-SHA256 usando o webhook secret.
 * A assinatura vem no header `x-ycloud-signature`.
 */
function verifyYCloudSignature(req: Request): boolean {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET || "";
  if (!secret) {
    logger.warn("YCloudWebhook", "YCLOUD_WEBHOOK_SECRET não configurado — pulando validação de assinatura");
    return true; // Permitir sem validação se secret não configurado
  }

  const signature = req.headers["x-ycloud-signature"] as string;
  if (!signature) {
    logger.warn("YCloudWebhook", "Header x-ycloud-signature ausente");
    // Em desenvolvimento, permitir sem assinatura
    return process.env.NODE_ENV !== "production";
  }

  try {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      logger.error("YCloudWebhook", "Assinatura HMAC inválida", { received: signature.substring(0, 10) + "..." });
    }

    return isValid;
  } catch (err) {
    logger.error("YCloudWebhook", "Erro ao verificar assinatura", err);
    return false;
  }
}

/**
 * POST /api/webhook/cloud — Recebimento de mensagens via YCloud
 *
 * NOTA: Reutilizamos o endpoint /api/webhook/cloud que o Clóvis já configurou no YCloud.
 * O handler detecta automaticamente se o payload é formato YCloud ou Meta Cloud API.
 */
export async function handleYCloudWebhookMessage(req: Request, res: Response): Promise<void> {
  // Responder imediatamente (YCloud espera resposta rápida)
  res.status(200).send("EVENT_RECEIVED");

  try {
    const body = req.body;

    // Verificar se é um evento YCloud
    if (!body.type || !body.type.startsWith("whatsapp.")) {
      logger.debug("YCloudWebhook", `Evento ignorado: ${body.type || "sem tipo"}`);
      return;
    }

    // Processar apenas mensagens inbound
    if (body.type !== "whatsapp.inbound_message.received") {
      logger.info("YCloudWebhook", `Evento não-mensagem: ${body.type}`);
      return;
    }

    const msg = body.whatsappInboundMessage;
    if (!msg) {
      logger.warn("YCloudWebhook", "Payload sem whatsappInboundMessage");
      return;
    }

    const messageId = msg.id || body.id;
    const from = msg.from || ""; // E.164 format: "+5517988112791"
    const pushName = msg.customerProfile?.name || "";
    const messageType = msg.type || "unknown";

    // Deduplicação
    if (messageId && isWebhookDuplicate(messageId)) {
      logger.info("YCloudWebhook", `Evento duplicado ignorado: ${messageId}`);
      return;
    }

    logger.info("YCloudWebhook", `Mensagem de ${from} (${pushName}) | Tipo: ${messageType} | ID: ${messageId}`);

    let messageText = "";

    // Extrair texto conforme o tipo
    if (messageType === "text" && msg.text?.body) {
      messageText = msg.text.body;
    } else if (messageType === "interactive") {
      if (msg.interactive?.button_reply) {
        messageText = msg.interactive.button_reply.title;
      } else if (msg.interactive?.list_reply) {
        messageText = msg.interactive.list_reply.title;
      }
    } else if (messageType === "image" && msg.image?.caption) {
      messageText = msg.image.caption;
    } else if (messageType === "audio" || messageType === "voice") {
      // YCloud não fornece transcrição automática
      // Podemos tentar baixar o áudio se houver URL
      if (msg.audio?.link || msg.voice?.link) {
        logger.info("YCloudWebhook", `Áudio recebido via YCloud, URL: ${msg.audio?.link || msg.voice?.link}`);
        // TODO: implementar transcrição via URL direta quando disponível
        messageText = "[Áudio recebido - transcrição via YCloud em desenvolvimento]";
      } else {
        messageText = "[Áudio recebido - não foi possível processar]";
      }
    } else if (messageType === "sticker" || messageType === "reaction") {
      logger.info("YCloudWebhook", `${messageType} ignorado`);
      return;
    } else {
      logger.info("YCloudWebhook", `Tipo não suportado: ${messageType}`);
      return;
    }

    // Validar e sanitizar
    const safeText = typeof messageText === "string" ? messageText.slice(0, 2000) : "";
    if (!safeText.trim()) {
      logger.info("YCloudWebhook", "Mensagem vazia ou inválida, ignorando");
      return;
    }

    // Marcar como lida
    if (messageId) {
      markMessageAsReadYCloud(messageId).catch(() => {});
    }

    // Normalizar telefone: remover + e caracteres não numéricos
    const phone = phoneNormalizer.normalize(from);
    const whatsappId = phone; // Usar número como ID (sem +)

    logger.info("YCloudWebhook", `Processando: "${safeText.substring(0, 100)}..." | Phone: ${phone}`);

    // Processar mensagem pelo chatbot (fire-and-forget)
    processIncomingMessage(whatsappId, phone, safeText, messageId, pushName || undefined)
      .then(() => logger.info("YCloudWebhook", `Mensagem processada com sucesso: ${messageId}`))
      .catch((err) => logger.error("YCloudWebhook", `Erro ao processar mensagem ${messageId}`, err));

  } catch (error) {
    logger.error("YCloudWebhook", "Erro ao processar webhook:", error);
  }
}

/**
 * Detecta se um payload de webhook é do formato YCloud.
 * Usado para roteamento automático no endpoint /api/webhook/cloud.
 */
export function isYCloudPayload(body: any): boolean {
  return !!(
    body &&
    typeof body.type === "string" &&
    body.type.startsWith("whatsapp.") &&
    body.apiVersion === "v2"
  );
}
