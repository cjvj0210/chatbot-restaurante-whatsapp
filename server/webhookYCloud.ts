import type { Request, Response } from "express";
import crypto from "crypto";
import { processIncomingMessage, resumeConversationAfterBot } from "./chatbot";
import { markMessageAsReadYCloud, transcribeAudioYCloud, sendTextMessageYCloud } from "./ycloudApi";
import { isBotSentMessage } from "./botMessageTracker";
import {
  activateHumanModeForJid,
  deactivateHumanModeForJid,
  isHumanModeActiveForJid,
} from "./services/humanModeService";
import { createMessage, getActiveConversationByWhatsappId, getCustomerByWhatsappId } from "./db";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { CHATBOT } from "../shared/constants";
import { logger } from "./utils/logger";

/**
 * Webhook handler para YCloud (BSP do WhatsApp)
 *
 * Eventos processados:
 *
 * 1. whatsapp.inbound_message.received — Mensagens de CLIENTES
 *    Payload: { whatsappInboundMessage: { from: "+55...", to: "+55...", type, text, ... } }
 *
 * 2. whatsapp.smb.message.echoes — Mensagens enviadas pelo OPERADOR via WhatsApp Business App
 *    Payload: { whatsappMessage: { from: "BUSINESS", to: "CUSTOMER", type, text, ... } }
 *    Usado para detectar:
 *    - Comando #bot → desativa modo humano e retoma bot
 *    - Respostas manuais do operador → ativa modo humano (silencia bot)
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

function isWebhookDuplicate(eventId: string): boolean {
  if (recentWebhookEvents.has(eventId)) return true;
  recentWebhookEvents.set(eventId, Date.now());
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
 * Processa evento whatsapp.smb.message.echoes — mensagens enviadas pelo operador
 * via WhatsApp Business App.
 *
 * Se o operador enviar "#bot", desativa o modo humano e retoma o bot.
 * Qualquer outra mensagem do operador ativa o modo humano (silencia o bot).
 */
async function handleSmbMessageEcho(body: any): Promise<void> {
  const msg = body.whatsappMessage;
  if (!msg) {
    logger.warn("YCloudWebhook", "Evento smb.message.echoes sem whatsappMessage");
    return;
  }

  const messageId = msg.wamid || msg.id || body.id;
  const fromBusiness = msg.from || ""; // Número do negócio (restaurante)
  const toCustomer = msg.to || ""; // Número do cliente
  const messageType = msg.type || "unknown";

  // Deduplicação
  if (messageId && isWebhookDuplicate(`echo_${messageId}`)) {
    logger.info("YCloudWebhook", `Echo duplicado ignorado: ${messageId}`);
    return;
  }

  // Ignorar mensagens enviadas pelo bot via API (não são do operador humano)
  if (messageId && await isBotSentMessage(messageId)) {
    logger.debug("YCloudWebhook", `Echo de mensagem do bot ignorado: ${messageId}`);
    return;
  }

  logger.info("YCloudWebhook", `📤 Echo do operador: ${fromBusiness} → ${toCustomer} | Tipo: ${messageType} | ID: ${messageId}`);

  // Extrair texto da mensagem do operador
  let messageText = "";
  if (messageType === "text" && msg.text?.body) {
    messageText = msg.text.body.trim();
  } else if (messageType === "image" && msg.image?.caption) {
    messageText = `[Imagem enviada pelo atendente: ${msg.image.caption}]`;
  } else if (messageType === "image") {
    messageText = "[Imagem enviada pelo atendente]";
  } else if (messageType === "audio" || messageType === "voice") {
    messageText = "[Áudio enviado pelo atendente]";
  } else if (messageType === "document") {
    messageText = `[Documento enviado pelo atendente: ${msg.document?.filename || "arquivo"}]`;
  }

  // Normalizar o número do cliente para uso como JID
  const customerPhone = phoneNormalizer.normalize(toCustomer);
  const customerJid = customerPhone; // Para YCloud, usamos apenas o número normalizado

  // ===== SALVAR MENSAGEM DO OPERADOR NO HISTÓRICO =====
  // Isso permite que o bot tenha contexto do que o atendente humano conversou
  // quando retomar a conversa após #bot.
  // Salvamos como role "assistant" com metadata { humanOperator: true } para diferenciar.
  if (messageText && !BOT_COMMANDS.has(messageText.toLowerCase())) {
    await saveOperatorMessageToHistory(customerJid, customerPhone, messageText)
      .catch((err) => logger.warn("YCloudWebhook", "Falha ao salvar mensagem do operador no histórico", err));
  }

  // Verificar se é um comando para reativar o bot
  if (messageText && BOT_COMMANDS.has(messageText.toLowerCase())) {
    logger.info("YCloudWebhook", `🤖 Comando #bot detectado! Desativando modo humano para ${customerPhone}`);

    // 1. Desativar modo humano
    await deactivateHumanModeForJid(customerJid, customerPhone);

    // 2. Enviar confirmação ao cliente
    //    NOTA: Não é possível deletar mensagens via YCloud API, então enviamos uma
    //    confirmação visual para que o cliente entenda que o bot retomou.
    sendTextMessageYCloud(
      customerPhone,
      "✅ *Gauchinho reativado!* 🤠\n\nO atendimento automático foi retomado. Como posso te ajudar?"
    ).catch((err) => logger.warn("YCloudWebhook", "Falha ao enviar confirmação de retomada", err));

    // 3. Retomar conversa automaticamente (gera resposta para mensagem pendente do cliente)
    //    Aguardar 2s para a confirmação ser entregue antes de gerar a resposta
    setTimeout(() => {
      resumeConversationAfterBot(customerJid, customerPhone)
        .then(() => logger.info("YCloudWebhook", `✅ Bot retomado com sucesso para ${customerPhone}`))
        .catch((err) => logger.error("YCloudWebhook", `Erro ao retomar bot para ${customerPhone}`, err));
    }, 2000);

    return;
  }

  // Qualquer outra mensagem do operador → ativar modo humano (silenciar bot)
  // Verificar se já está em modo humano para não enviar notificação repetida
  const isAlreadyHuman = await isHumanModeActiveForJid(customerJid, customerPhone);
  await activateHumanModeForJid(customerJid, customerPhone);

  if (!isAlreadyHuman) {
    // Primeira mensagem do operador: enviar notificação ao operador
    const restaurantPhone = process.env.RESTAURANT_PHONE?.replace(/\D/g, "") || "";
    if (restaurantPhone) {
      const restaurantPhoneNorm = restaurantPhone.startsWith("55") ? restaurantPhone : `55${restaurantPhone}`;
      sendTextMessageYCloud(
        restaurantPhoneNorm,
        `👤 Modo humano ativado para ${customerPhone} (30 min).\nO bot está pausado.\nEnvie *#bot* na conversa do cliente para reativar.`
      ).catch(() => {});
    }
    logger.info("YCloudWebhook", `👤 Operador respondeu manualmente para ${customerPhone} — modo humano ATIVADO (primeira msg)`);
  } else {
    logger.info("YCloudWebhook", `👤 Operador respondeu manualmente para ${customerPhone} — modo humano já ativo`);
  }
}

/**
 * Salva a mensagem do operador humano no histórico da conversa.
 * Isso permite que o bot tenha contexto completo do que foi conversado
 * durante o modo humano quando retomar após #bot.
 *
 * As mensagens são salvas como role "assistant" com metadata { humanOperator: true }
 * para que apareçam no histórico da LLM como respostas do "assistente",
 * mas sejam identificáveis como vindas do operador humano.
 */
async function saveOperatorMessageToHistory(
  customerJid: string,
  customerPhone: string,
  messageText: string
): Promise<void> {
  try {
    // Buscar customer pelo número do cliente
    const customer = await getCustomerByWhatsappId(customerJid, customerPhone);
    if (!customer) {
      logger.debug("YCloudWebhook", `Customer não encontrado para salvar echo: ${customerPhone}`);
      return;
    }

    // Buscar conversa ativa
    const conversation = await getActiveConversationByWhatsappId(customerJid, customerPhone);
    if (!conversation) {
      logger.debug("YCloudWebhook", `Conversa ativa não encontrada para salvar echo: ${customerPhone}`);
      return;
    }

    // Salvar como role "assistant" com metadata indicando que é do operador humano
    await createMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: messageText,
      messageType: "text",
      metadata: JSON.stringify({ humanOperator: true, humanMode: true }),
    });

    logger.info("YCloudWebhook", `💾 Mensagem do operador salva no histórico: "${messageText.substring(0, 80)}" (conv ${conversation.id})`);
  } catch (err) {
    logger.warn("YCloudWebhook", `Falha ao salvar mensagem do operador no histórico para ${customerPhone}`, err);
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

    // ===== PROCESSAR ECHOES DO OPERADOR (WhatsApp Business App) =====
    if (body.type === "whatsapp.smb.message.echoes") {
      await handleSmbMessageEcho(body)
        .catch((err) => logger.error("YCloudWebhook", "Erro ao processar echo do operador", err));
      return;
    }

    // ===== PROCESSAR MENSAGENS INBOUND (de clientes) =====
    if (body.type !== "whatsapp.inbound_message.received") {
      logger.info("YCloudWebhook", `Evento não processado: ${body.type}`);
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

    logger.info("YCloudWebhook", `📩 Mensagem de ${from} (${pushName}) | Tipo: ${messageType} | ID: ${messageId}`);

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
      // Transcrever áudio via YCloud (baixar pela URL direta + Whisper)
      const audioUrl = msg.audio?.link || msg.voice?.link;
      if (audioUrl) {
        logger.info("YCloudWebhook", `Áudio recebido via YCloud, transcrevendo... URL: ${audioUrl.substring(0, 60)}...`);
        const transcription = await transcribeAudioYCloud(audioUrl);
        if (transcription) {
          messageText = transcription;
          logger.info("YCloudWebhook", `Áudio transcrito: "${messageText.substring(0, 80)}"`);
        } else {
          messageText = "[Áudio recebido - não foi possível transcrever]";
        }
      } else {
        messageText = "[Áudio recebido - sem URL para download]";
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
