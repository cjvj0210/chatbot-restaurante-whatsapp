import type { Request, Response } from "express";
import { getWhatsappSettings } from "./db";
import { processIncomingMessage } from "./chatbot";
import { markMessageAsRead } from "./whatsapp";
import { logWebhookRequest } from "./debug";

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: "text" | "image" | "audio" | "interactive" | "voice";
        text?: {
          body: string;
        };
        audio?: {
          id: string;
          mime_type: string;
        };
        voice?: {
          id: string;
          mime_type: string;
        };
        interactive?: {
          type: string;
          button_reply?: {
            id: string;
            title: string;
          };
          list_reply?: {
            id: string;
            title: string;
            description?: string;
          };
        };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

/**
 * Webhook GET - Verificação do WhatsApp
 */
export async function handleWebhookVerification(req: Request, res: Response): Promise<void> {
  logWebhookRequest(req);
  console.log("[Webhook] GET request received:", {
    query: req.query,
    headers: req.headers
  });
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const settings = await getWhatsappSettings();
  console.log("[Webhook] Settings loaded:", {
    hasSettings: !!settings,
    isActive: settings?.isActive,
    hasToken: !!settings?.webhookVerifyToken
  });
  
  if (!settings) {
    console.error("[Webhook] WhatsApp settings not configured");
    res.status(403).send("Settings not configured");
    return;
  }

  if (mode === "subscribe" && token === settings.webhookVerifyToken) {
    console.log("[Webhook] Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.error("[Webhook] Verification failed");
    res.status(403).send("Verification failed");
  }
}

/**
 * Webhook POST - Recebimento de mensagens
 */
export async function handleWebhookMessage(req: Request, res: Response): Promise<void> {
  logWebhookRequest(req);
  console.log("[Webhook] POST request received:", {
    body: JSON.stringify(req.body, null, 2),
    headers: req.headers
  });
  
  try {
    const body = req.body as WhatsAppWebhookPayload;

    // Responder imediatamente ao WhatsApp
    res.status(200).send("EVENT_RECEIVED");
    console.log("[Webhook] Responded with EVENT_RECEIVED");

    // Processar mensagens de forma assíncrona
    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === "messages") {
            const value = change.value;

            // Processar mensagens recebidas
            if (value.messages) {
              for (const message of value.messages) {
                const from = message.from;
                const messageId = message.id;
                let messageText = "";

                // Extrair texto da mensagem
                if (message.type === "text" && message.text) {
                  messageText = message.text.body;
                } else if (message.type === "interactive" && message.interactive) {
                  if (message.interactive.button_reply) {
                    messageText = message.interactive.button_reply.title;
                  } else if (message.interactive.list_reply) {
                    messageText = message.interactive.list_reply.title;
                  }
                } else if ((message.type === "audio" || message.type === "voice") && (message.audio || message.voice)) {
                  // Processar áudio: baixar, transcrever e processar
                  const audioId = message.audio?.id || message.voice?.id;
                  if (audioId) {
                    console.log(`[Webhook] Audio message received: ${audioId}`);
                    // Importar função de transcrição
                    const { transcribeWhatsAppAudio } = await import("./audioTranscription");
                    const transcription = await transcribeWhatsAppAudio(audioId);
                    if (transcription) {
                      messageText = transcription;
                      console.log(`[Webhook] Audio transcribed: "${messageText}"`);
                    } else {
                      console.log(`[Webhook] Failed to transcribe audio`);
                      messageText = "[Mensagem de áudio - não foi possível transcrever]";
                    }
                  }
                }

                if (messageText) {
                  console.log(`[Webhook] Processing message from ${from}: "${messageText}"`);
                  
                  // Marcar como lida
                  await markMessageAsRead(messageId);
                  console.log(`[Webhook] Message ${messageId} marked as read`);

                  // Processar mensagem
                  await processIncomingMessage(from, from, messageText, messageId);
                  console.log(`[Webhook] Message processed successfully`);
                } else {
                  console.log(`[Webhook] Message type ${message.type} not supported or empty`);
                }
              }
            }

            // Log de status de mensagens enviadas
            if (value.statuses) {
              for (const status of value.statuses) {
                console.log(`[Webhook] Message ${status.id} status: ${status.status}`);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
  }
}
