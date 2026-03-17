import axios from "axios";
import { registerBotSentMessage } from "./botMessageTracker";
import { withRetry } from "./utils/retry";
import { logger } from "./utils/logger";

/**
 * Módulo de integração com a YCloud API para WhatsApp
 *
 * YCloud é um BSP (Business Solution Provider) que permite usar a
 * Cloud API do WhatsApp com coexistência (App Business + API no mesmo número).
 *
 * Diferenças principais vs Meta Cloud API direta:
 * - Autenticação via X-API-Key header (não Bearer token)
 * - Endpoint: api.ycloud.com (não graph.facebook.com)
 * - Body usa `from` e `to` em formato E.164 (com +)
 * - Não precisa de `messaging_product` ou `recipient_type`
 * - Não precisa de `phone_number_id` na URL
 */

const YCLOUD_API_BASE = "https://api.ycloud.com/v2";

function getYCloudConfig() {
  return {
    apiKey: process.env.YCLOUD_API_KEY || "",
    restaurantPhone: process.env.RESTAURANT_PHONE || "",
  };
}

export function isYCloudConfigured(): boolean {
  const { apiKey, restaurantPhone } = getYCloudConfig();
  return !!(apiKey && restaurantPhone);
}

/**
 * Formata número para E.164 (com +55 prefix para Brasil)
 */
function toE164(phone: string): string {
  // Remover JID suffixes e caracteres não numéricos
  const digits = phone
    .replace(/@s\.whatsapp\.net|@lid|@g\.us/g, "")
    .replace(/\D/g, "");

  // Adicionar código do país se necessário
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
}

/**
 * Envia uma mensagem de texto simples via YCloud API
 */
export async function sendTextMessageYCloud(to: string, text: string): Promise<boolean> {
  try {
    const { apiKey, restaurantPhone } = getYCloudConfig();
    if (!apiKey || !restaurantPhone) {
      logger.error("YCloud", "API Key ou telefone do restaurante não configurados", null);
      return false;
    }

    const fromE164 = toE164(restaurantPhone);
    const toE164Num = toE164(to);

    // Habilitar preview de URL quando a mensagem contém links
    const hasUrl = /https?:\/\//.test(text);

    const response = await withRetry(
      () =>
        axios.post(
          `${YCLOUD_API_BASE}/whatsapp/messages/sendDirectly`,
          {
            from: fromE164,
            to: toE164Num,
            type: "text",
            text: { preview_url: hasUrl, body: text },
          },
          {
            headers: {
              "X-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        ),
      { maxRetries: 3, delayMs: 1000, label: "sendTextMessageYCloud" }
    );

    const sentMessageId = response.data?.wamid || response.data?.id;
    logger.info("YCloud", `Mensagem enviada: ${sentMessageId || "ok"}`);
    if (sentMessageId) {
      await registerBotSentMessage(sentMessageId);
    }
    return true;
  } catch (error: any) {
    logger.error("YCloud", "Erro ao enviar mensagem", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Envia mensagem de texto e retorna o ID da mensagem enviada.
 */
export async function sendTextMessageYCloudWithId(to: string, text: string): Promise<string | null> {
  try {
    const { apiKey, restaurantPhone } = getYCloudConfig();
    if (!apiKey || !restaurantPhone) return null;

    const fromE164 = toE164(restaurantPhone);
    const toE164Num = toE164(to);

    const response = await withRetry(
      () =>
        axios.post(
          `${YCLOUD_API_BASE}/whatsapp/messages/sendDirectly`,
          {
            from: fromE164,
            to: toE164Num,
            type: "text",
            text: { preview_url: false, body: text },
          },
          {
            headers: {
              "X-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          }
        ),
      { maxRetries: 2, delayMs: 500, label: "sendTextMessageYCloudWithId" }
    );

    const sentId = response.data?.wamid || response.data?.id;
    if (sentId) {
      await registerBotSentMessage(sentId);
    }
    return sentId || null;
  } catch (error: any) {
    logger.error("YCloud", "Erro ao enviar mensagem com ID", error?.response?.data || error?.message);
    return null;
  }
}

/**
 * Envia uma mensagem de imagem com legenda via YCloud API
 */
export async function sendMediaMessageYCloud(
  to: string,
  imageUrl: string,
  caption: string
): Promise<boolean> {
  try {
    const { apiKey, restaurantPhone } = getYCloudConfig();
    if (!apiKey || !restaurantPhone) {
      logger.error("YCloud", "API Key ou telefone do restaurante não configurados", null);
      return false;
    }

    const fromE164 = toE164(restaurantPhone);
    const toE164Num = toE164(to);

    const response = await withRetry(
      () =>
        axios.post(
          `${YCLOUD_API_BASE}/whatsapp/messages/sendDirectly`,
          {
            from: fromE164,
            to: toE164Num,
            type: "image",
            image: {
              link: imageUrl,
              caption,
            },
          },
          {
            headers: {
              "X-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        ),
      { maxRetries: 3, delayMs: 1000, label: "sendMediaMessageYCloud" }
    );

    const sentMediaId = response.data?.wamid || response.data?.id;
    logger.info("YCloud", `Mídia enviada: ${sentMediaId || "ok"}`);
    if (sentMediaId) {
      await registerBotSentMessage(sentMediaId);
    }
    return true;
  } catch (error: any) {
    logger.error("YCloud", "Erro ao enviar mídia", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Marca uma mensagem como lida via YCloud API
 */
export async function markMessageAsReadYCloud(messageId: string): Promise<boolean> {
  try {
    const { apiKey } = getYCloudConfig();
    if (!apiKey) return false;

    await axios.post(
      `${YCLOUD_API_BASE}/whatsapp/inboundMessages/${messageId}/markAsRead`,
      {},
      {
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return true;
  } catch (error: any) {
    logger.error("YCloud", "Erro ao marcar como lida", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * deleteMessageForEveryone — NÃO SUPORTADO via YCloud.
 * Retorna false silenciosamente.
 */
export async function deleteMessageForEveryoneYCloud(
  _remoteJid: string,
  _messageId: string,
  _fromMe: boolean = true
): Promise<boolean> {
  logger.warn("YCloud", "deleteMessageForEveryone não suportado via YCloud — operação ignorada");
  return false;
}
