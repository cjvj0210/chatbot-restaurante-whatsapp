import axios from "axios";
import { registerBotSentMessage } from "./botMessageTracker";
import { withRetry } from "./utils/retry";
import { logger } from "./utils/logger";

/**
 * Módulo de integração com a Meta Cloud API (WhatsApp Business Platform)
 * Usa a Graph API oficial para envio de mensagens via WhatsApp.
 *
 * Diferenças principais vs Evolution API:
 * - Autenticação via Bearer token (não apikey header)
 * - Endpoint: graph.facebook.com/v22.0/{phoneNumberId}/messages
 * - Formato de payload diferente (messaging_product, recipient_type, etc.)
 * - Não suporta deleteMessageForEveryone (API oficial não permite)
 * - Áudio: precisa baixar via media endpoint com token
 */

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getCloudApiConfig() {
  return {
    token: process.env.META_CLOUD_API_TOKEN || "",
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || "",
    wabaId: process.env.META_WABA_ID || "",
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || "",
  };
}

export function isCloudApiConfigured(): boolean {
  const { token, phoneNumberId } = getCloudApiConfig();
  return !!(token && phoneNumberId);
}

/**
 * Envia uma mensagem de texto simples via Cloud API
 */
export async function sendTextMessageCloudApi(to: string, text: string): Promise<boolean> {
  try {
    const { token, phoneNumberId } = getCloudApiConfig();
    if (!token || !phoneNumberId) {
      logger.error("CloudAPI", "Token ou Phone Number ID não configurados", null);
      return false;
    }

    // Normalizar número: remover JID suffixes, manter apenas dígitos
    const normalizedTo = to
      .replace("@s.whatsapp.net", "")
      .replace("@lid", "")
      .replace(/\D/g, "");

    // Habilitar preview de URL quando a mensagem contém links (pedidos, cardápio, etc.)
    const hasUrl = /https?:\/\//.test(text);

    const response = await withRetry(
      () =>
        axios.post(
          `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedTo,
            type: "text",
            text: { preview_url: hasUrl, body: text },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        ),
      { maxRetries: 3, delayMs: 1000, label: "sendTextMessageCloudApi" }
    );

    const sentMessageId = response.data?.messages?.[0]?.id;
    logger.info("CloudAPI", `Mensagem enviada: ${sentMessageId || "ok"}`);
    if (sentMessageId) {
      await registerBotSentMessage(sentMessageId);
    }
    return true;
  } catch (error: any) {
    logger.error("CloudAPI", "Erro ao enviar mensagem", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Envia mensagem de texto e retorna o ID da mensagem enviada.
 * Usado para mensagens que precisam ser rastreadas.
 */
export async function sendTextMessageCloudApiWithId(to: string, text: string): Promise<string | null> {
  try {
    const { token, phoneNumberId } = getCloudApiConfig();
    if (!token || !phoneNumberId) return null;

    const normalizedTo = to
      .replace("@s.whatsapp.net", "")
      .replace("@lid", "")
      .replace(/\D/g, "");

    const response = await withRetry(
      () =>
        axios.post(
          `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedTo,
            type: "text",
            text: { preview_url: false, body: text },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          }
        ),
      { maxRetries: 2, delayMs: 500, label: "sendTextMessageCloudApiWithId" }
    );

    const sentId = response.data?.messages?.[0]?.id;
    if (sentId) {
      await registerBotSentMessage(sentId);
    }
    return sentId || null;
  } catch (error: any) {
    logger.error("CloudAPI", "Erro ao enviar mensagem com ID", error?.response?.data || error?.message);
    return null;
  }
}

/**
 * Envia uma mensagem de imagem com legenda via Cloud API
 */
export async function sendMediaMessageCloudApi(
  to: string,
  imageUrl: string,
  caption: string
): Promise<boolean> {
  try {
    const { token, phoneNumberId } = getCloudApiConfig();
    if (!token || !phoneNumberId) {
      logger.error("CloudAPI", "Token ou Phone Number ID não configurados", null);
      return false;
    }

    const normalizedTo = to
      .replace("@s.whatsapp.net", "")
      .replace("@lid", "")
      .replace(/\D/g, "");

    const response = await withRetry(
      () =>
        axios.post(
          `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: normalizedTo,
            type: "image",
            image: {
              link: imageUrl,
              caption,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        ),
      { maxRetries: 3, delayMs: 1000, label: "sendMediaMessageCloudApi" }
    );

    const sentMediaId = response.data?.messages?.[0]?.id;
    logger.info("CloudAPI", `Mídia enviada: ${sentMediaId || "ok"}`);
    if (sentMediaId) {
      await registerBotSentMessage(sentMediaId);
    }
    return true;
  } catch (error: any) {
    logger.error("CloudAPI", "Erro ao enviar mídia", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Marca uma mensagem como lida via Cloud API
 */
export async function markMessageAsReadCloudApi(messageId: string): Promise<boolean> {
  try {
    const { token, phoneNumberId } = getCloudApiConfig();
    if (!token || !phoneNumberId) return false;

    await axios.post(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    return true;
  } catch (error: any) {
    logger.error("CloudAPI", "Erro ao marcar como lida", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Baixa áudio do WhatsApp via Cloud API (Graph API media endpoint)
 * Retorna o buffer do arquivo para transcrição
 */
export async function downloadMediaCloudApi(mediaId: string): Promise<Buffer | null> {
  try {
    const { token } = getCloudApiConfig();
    if (!token) {
      logger.error("CloudAPI", "Token não configurado para download de mídia", null);
      return null;
    }

    // 1. Obter URL do áudio via Graph API
    const mediaResponse = await axios.get(
      `${GRAPH_API_BASE}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      }
    );

    const audioUrl = mediaResponse.data?.url;
    if (!audioUrl) {
      logger.error("CloudAPI", "Sem URL na resposta de mídia", mediaResponse.data);
      return null;
    }

    // 2. Baixar o arquivo de áudio (precisa do token também)
    const audioResponse = await axios.get(audioUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
      timeout: 30000,
    });

    return Buffer.from(audioResponse.data);
  } catch (error: any) {
    logger.error("CloudAPI", "Erro ao baixar mídia", error?.response?.data || error?.message);
    return null;
  }
}

/**
 * Transcreve áudio recebido via Cloud API
 * Baixa o áudio via Graph API e usa Whisper para transcrever
 */
export async function transcribeAudioCloudApi(mediaId: string): Promise<string | null> {
  try {
    const audioBuffer = await downloadMediaCloudApi(mediaId);
    if (!audioBuffer) return null;

    // Salvar temporariamente
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { transcribeAudio } = await import("./_core/voiceTranscription");

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `cloudapi-audio-${mediaId}.ogg`);
    fs.writeFileSync(tempFilePath, audioBuffer);

    logger.info("CloudAPI", `Áudio salvo em ${tempFilePath} (${audioBuffer.length} bytes)`);

    // Transcrever usando Whisper
    const result = await transcribeAudio({
      audioUrl: tempFilePath,
      language: "pt",
    });

    // Limpar arquivo temporário
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      logger.warn("CloudAPI", "Falha ao limpar arquivo temporário", e);
    }

    if ("error" in result) {
      logger.error("CloudAPI", `Erro na transcrição: ${result.error}`, null);
      return null;
    }

    return result?.text || null;
  } catch (error: any) {
    logger.error("CloudAPI", "Erro ao transcrever áudio", error?.message);
    return null;
  }
}

/**
 * deleteMessageForEveryone — NÃO SUPORTADO na Cloud API oficial.
 * A Meta não permite apagar mensagens via API. Retorna false silenciosamente.
 * O comando #bot e notificações silenciosas precisam de tratamento alternativo.
 */
export async function deleteMessageForEveryoneCloudApi(
  _remoteJid: string,
  _messageId: string,
  _fromMe: boolean = true
): Promise<boolean> {
  logger.warn("CloudAPI", "deleteMessageForEveryone não suportado na Cloud API oficial — operação ignorada");
  return false;
}
