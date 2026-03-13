/**
 * WhatsApp Service - Abstração unificada para envio de mensagens WhatsApp
 *
 * Decide automaticamente qual API usar:
 *   1. Evolution API (se EVOLUTION_API_URL + EVOLUTION_API_KEY configurados)
 *   2. Meta Cloud API (fallback via whatsapp.ts)
 */

import { sendTextMessageEvolution, sendMediaMessageEvolution } from "../evolutionApi";
import { sendTextMessage } from "../whatsapp";

function useEvolution(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

export const whatsappService = {
  /**
   * Envia mensagem de texto simples.
   * @param to - JID do destinatário (ex: 5517988112791@s.whatsapp.net ou 212454869074102@lid)
   *             Para Meta Cloud API, pode ser apenas o número normalizado.
   * @param text - Texto a ser enviado
   */
  async sendText(to: string, text: string): Promise<boolean> {
    if (useEvolution()) {
      return sendTextMessageEvolution(to, text);
    }
    // Meta Cloud API usa apenas os dígitos do número
    const phone = to.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, "");
    return sendTextMessage(phone, text);
  },

  /**
   * Envia mensagem de mídia (imagem) com legenda.
   * @param to - JID do destinatário
   * @param url - URL pública da imagem
   * @param caption - Legenda/texto da imagem
   */
  async sendMedia(to: string, url: string, caption: string): Promise<boolean> {
    if (useEvolution()) {
      return sendMediaMessageEvolution(to, url, caption);
    }
    // Meta Cloud API não tem suporte a mídia simples aqui — fallback para texto
    return sendTextMessage(
      to.replace("@s.whatsapp.net", "").replace("@lid", "").replace(/\D/g, ""),
      `${caption}\n\n${url}`
    );
  },
};
