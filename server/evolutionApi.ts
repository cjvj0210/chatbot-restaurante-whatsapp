import axios from "axios";

/**
 * Módulo de integração com a Evolution API v2.3.7
 * Substitui a Meta Cloud API para envio de mensagens via WhatsApp Web (QR Code)
 */

// Configurações da Evolution API (via variáveis de ambiente)
function getEvolutionConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL || "";
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "teste";
  return { baseUrl, apiKey, instanceName };
}

/**
 * Envia uma mensagem de texto simples via Evolution API
 */
export async function sendTextMessageEvolution(to: string, text: string): Promise<boolean> {
  try {
    const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

    if (!baseUrl || !apiKey) {
      console.error("[EvolutionAPI] URL ou API Key não configurados");
      return false;
    }

    // Normalizar número: remover @s.whatsapp.net se vier assim, garantir formato 55XXXXXXXXXXX
    const normalizedTo = to.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    const response = await axios.post(
      `${baseUrl}/message/sendText/${instanceName}`,
      {
        number: normalizedTo,
        text: text,
      },
      {
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log("[EvolutionAPI] Mensagem enviada:", response.data?.key?.id || "ok");
    return true;
  } catch (error: any) {
    console.error("[EvolutionAPI] Erro ao enviar mensagem:", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Baixa o conteúdo de um arquivo de mídia via Evolution API
 * Retorna o buffer do arquivo para transcrição
 */
export async function downloadMediaEvolution(messageId: string, instanceName?: string): Promise<Buffer | null> {
  try {
    const { baseUrl, apiKey, instanceName: defaultInstance } = getEvolutionConfig();

    if (!baseUrl || !apiKey) {
      console.error("[EvolutionAPI] URL ou API Key não configurados");
      return null;
    }

    const instance = instanceName || defaultInstance;

    const response = await axios.post(
      `${baseUrl}/chat/getBase64FromMediaMessage/${instance}`,
      {
        message: { key: { id: messageId } },
        convertToMp4: false,
      },
      {
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data?.base64) {
      const base64Data = response.data.base64.replace(/^data:[^;]+;base64,/, "");
      return Buffer.from(base64Data, "base64");
    }

    console.error("[EvolutionAPI] Sem base64 na resposta:", response.data);
    return null;
  } catch (error: any) {
    console.error("[EvolutionAPI] Erro ao baixar mídia:", error?.response?.data || error?.message);
    return null;
  }
}

/**
 * Envia uma mensagem de imagem com legenda via Evolution API
 * Usado para enviar o banner do cardápio digital de forma visual e comercial
 */
export async function sendMediaMessageEvolution(
  to: string,
  imageUrl: string,
  caption: string
): Promise<boolean> {
  try {
    const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

    if (!baseUrl || !apiKey) {
      console.error("[EvolutionAPI] URL ou API Key não configurados");
      return false;
    }

    const normalizedTo = to.replace("@s.whatsapp.net", "").replace(/\D/g, "");

    const response = await axios.post(
      `${baseUrl}/message/sendMedia/${instanceName}`,
      {
        number: normalizedTo,
        mediatype: "image",
        mimetype: "image/jpeg",
        media: imageUrl,
        caption: caption,
      },
      {
        headers: {
          apikey: apiKey,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log("[EvolutionAPI] Mídia enviada:", response.data?.key?.id || "ok");
    return true;
  } catch (error: any) {
    console.error("[EvolutionAPI] Erro ao enviar mídia:", error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Verifica o status da instância na Evolution API
 */
export async function checkInstanceStatus(): Promise<"open" | "close" | "connecting" | "unknown"> {
  try {
    const { baseUrl, apiKey, instanceName } = getEvolutionConfig();

    if (!baseUrl || !apiKey) return "unknown";

    const response = await axios.get(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: { apikey: apiKey },
        timeout: 10000,
      }
    );

    return response.data?.instance?.state || "unknown";
  } catch (error) {
    console.error("[EvolutionAPI] Erro ao verificar status:", error);
    return "unknown";
  }
}
