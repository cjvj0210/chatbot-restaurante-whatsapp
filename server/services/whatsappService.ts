/**
 * WhatsApp Service - Abstração unificada para envio de mensagens WhatsApp
 *
 * Decide qual API usar baseado na variável WHATSAPP_PROVIDER:
 *   - "ycloud" → YCloud BSP (coexistência App Business + API)
 *   - "cloud_api" → Meta Cloud API oficial (Graph API)
 *   - "evolution" (default) → Evolution API (WhatsApp Web não oficial)
 *
 * Todas as funções do chatbot usam este service, garantindo que a troca
 * de provider seja transparente para o resto do código.
 */

import { sendTextMessageEvolution, sendMediaMessageEvolution } from "../evolutionApi";
import {
  sendTextMessageCloudApi,
  sendMediaMessageCloudApi,
  isCloudApiConfigured,
} from "../cloudApi";
import {
  sendTextMessageYCloud,
  sendMediaMessageYCloud,
  isYCloudConfigured,
} from "../ycloudApi";
import { logger } from "../utils/logger";

type WhatsAppProvider = "evolution" | "cloud_api" | "ycloud";

function getProvider(): WhatsAppProvider {
  const provider = (process.env.WHATSAPP_PROVIDER || "evolution").toLowerCase();

  if (provider === "ycloud" && isYCloudConfigured()) {
    return "ycloud";
  }
  if (provider === "ycloud" && !isYCloudConfigured()) {
    logger.warn("WhatsAppService", "WHATSAPP_PROVIDER=ycloud mas credenciais não configuradas, tentando cloud_api como fallback");
    // Tentar fallback para cloud_api
    if (isCloudApiConfigured()) return "cloud_api";
    return "evolution";
  }

  if (provider === "cloud_api" && isCloudApiConfigured()) {
    return "cloud_api";
  }
  if (provider === "cloud_api" && !isCloudApiConfigured()) {
    logger.warn("WhatsAppService", "WHATSAPP_PROVIDER=cloud_api mas credenciais não configuradas, usando evolution como fallback");
  }
  return "evolution";
}

export const whatsappService = {
  /**
   * Retorna o provider ativo para diagnóstico
   */
  getActiveProvider(): WhatsAppProvider {
    return getProvider();
  },

  /**
   * Envia mensagem de texto simples.
   * @param to - JID do destinatário (ex: 5517988112791@s.whatsapp.net ou 212454869074102@lid)
   *             Para Cloud API/YCloud, normaliza para apenas dígitos.
   * @param text - Texto a ser enviado
   */
  async sendText(to: string, text: string): Promise<boolean> {
    const provider = getProvider();

    if (provider === "ycloud") {
      return sendTextMessageYCloud(to, text);
    }

    if (provider === "cloud_api") {
      return sendTextMessageCloudApi(to, text);
    }

    // Evolution API
    return sendTextMessageEvolution(to, text);
  },

  /**
   * Envia mensagem de mídia (imagem) com legenda.
   * @param to - JID do destinatário
   * @param url - URL pública da imagem
   * @param caption - Legenda/texto da imagem
   */
  async sendMedia(to: string, url: string, caption: string): Promise<boolean> {
    const provider = getProvider();

    if (provider === "ycloud") {
      return sendMediaMessageYCloud(to, url, caption);
    }

    if (provider === "cloud_api") {
      return sendMediaMessageCloudApi(to, url, caption);
    }

    // Evolution API
    return sendMediaMessageEvolution(to, url, caption);
  },
};
