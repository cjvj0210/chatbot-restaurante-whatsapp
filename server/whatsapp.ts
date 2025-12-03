import axios from "axios";
import { getWhatsappSettings } from "./db";

const WHATSAPP_API_VERSION = "v21.0";

interface WhatsAppTextMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url?: boolean;
    body: string;
  };
}

interface WhatsAppInteractiveButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

interface WhatsAppInteractiveMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    body: {
      text: string;
    };
    action: {
      buttons: WhatsAppInteractiveButton[];
    };
  };
}

interface WhatsAppListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

interface WhatsAppListMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "list";
    header?: {
      type: "text";
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      button: string;
      sections: WhatsAppListSection[];
    };
  };
}

/**
 * Envia uma mensagem de texto simples via WhatsApp Cloud API
 */
export async function sendTextMessage(to: string, text: string): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings || !settings.isActive) {
      console.error("[WhatsApp] Settings not configured or inactive");
      return false;
    }

    const message: WhatsAppTextMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        body: text,
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${settings.phoneNumberId}/messages`,
      message,
      {
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[WhatsApp] Message sent successfully:", response.data);
    return true;
  } catch (error) {
    console.error("[WhatsApp] Error sending message:", error);
    return false;
  }
}

/**
 * Envia uma mensagem com botões interativos
 */
export async function sendButtonMessage(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings || !settings.isActive) {
      console.error("[WhatsApp] Settings not configured or inactive");
      return false;
    }

    // WhatsApp permite no máximo 3 botões
    const limitedButtons = buttons.slice(0, 3);

    const message: WhatsAppInteractiveMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: bodyText,
        },
        action: {
          buttons: limitedButtons.map((btn) => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.title.substring(0, 20), // Máximo 20 caracteres
            },
          })),
        },
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${settings.phoneNumberId}/messages`,
      message,
      {
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[WhatsApp] Button message sent successfully:", response.data);
    return true;
  } catch (error) {
    console.error("[WhatsApp] Error sending button message:", error);
    return false;
  }
}

/**
 * Envia uma mensagem com lista interativa (menu)
 */
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: WhatsAppListSection[]
): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings || !settings.isActive) {
      console.error("[WhatsApp] Settings not configured or inactive");
      return false;
    }

    const message: WhatsAppListMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: bodyText,
        },
        action: {
          button: buttonText.substring(0, 20), // Máximo 20 caracteres
          sections,
        },
      },
    };

    const response = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${settings.phoneNumberId}/messages`,
      message,
      {
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[WhatsApp] List message sent successfully:", response.data);
    return true;
  } catch (error) {
    console.error("[WhatsApp] Error sending list message:", error);
    return false;
  }
}

/**
 * Marca uma mensagem como lida
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  try {
    const settings = await getWhatsappSettings();
    if (!settings || !settings.isActive) {
      return false;
    }

    await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${settings.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return true;
  } catch (error) {
    console.error("[WhatsApp] Error marking message as read:", error);
    return false;
  }
}

/**
 * Valida o webhook do WhatsApp
 */
export function verifyWebhook(mode: string, token: string, challenge: string, verifyToken: string): string | null {
  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp] Webhook verified successfully");
    return challenge;
  }
  console.error("[WhatsApp] Webhook verification failed");
  return null;
}
