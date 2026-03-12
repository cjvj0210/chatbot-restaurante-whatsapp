import type { Request, Response } from "express";
import { processIncomingMessage } from "./chatbot";
import { sendTextMessageEvolution, downloadMediaEvolution } from "./evolutionApi";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { conversations, customers } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

/**
 * Estrutura do payload de webhook da Evolution API v2.3.7
 * Evento: MESSAGES_UPSERT
 */
interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      audioMessage?: {
        url?: string;
        mimetype?: string;
        seconds?: number;
        ptt?: boolean;
        fileLength?: string;
      };
      imageMessage?: {
        caption?: string;
        url?: string;
        mimetype?: string;
      };
      documentMessage?: {
        caption?: string;
        fileName?: string;
      };
      stickerMessage?: object;
      reactionMessage?: {
        text: string;
      };
      buttonsResponseMessage?: {
        selectedButtonId: string;
        selectedDisplayText: string;
      };
      listResponseMessage?: {
        singleSelectReply: {
          selectedRowId: string;
        };
        title: string;
      };
    };
    messageType?: string;
    messageTimestamp?: number;
    instanceId?: string;
    source?: string;
  };
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

/**
 * Extrai o número de telefone do JID do WhatsApp
 * Ex: "5517999999999@s.whatsapp.net" → "5517999999999"
 */
function extractPhoneFromJid(jid: string): string {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(/\D/g, "");
}

/**
 * Endpoint POST - Recebe eventos da Evolution API
 */
export async function handleEvolutionWebhook(req: Request, res: Response): Promise<void> {
  // Responder imediatamente para não dar timeout na Evolution API
  res.status(200).send("OK");

  try {
    const payload = req.body as EvolutionWebhookPayload;

    // Validar autenticidade do webhook: verificar apikey enviada pela Evolution API
    const configuredKey = process.env.EVOLUTION_API_KEY || "";
    const receivedKey = payload.apikey || (req.headers["apikey"] as string) || "";
    if (configuredKey && receivedKey && receivedKey !== configuredKey) {
      console.warn("[EvolutionWebhook] apikey inválida — payload ignorado");
      return;
    }

    const timestamp = new Date().toISOString();
    console.log(`[EvolutionWebhook] [${timestamp}] Evento: ${payload.event} | Instância: ${payload.instance}`);

    // Tratar evento de conexão (detectar desconexão em tempo real)
    const eventNormalized = payload.event?.toUpperCase().replace(".", "_");
    if (eventNormalized === "CONNECTION_UPDATE") {
      const state = (payload.data as any)?.state || (payload.data as any)?.status;
      console.log(`[EvolutionWebhook] Conexão atualizada: ${JSON.stringify(payload.data)}`);
      if (state === "close" || state === "disconnected") {
        console.error(`[EvolutionWebhook] ⚠️ DESCONEXÃO DETECTADA via webhook!`);
      }
      return;
    }

    // Só processar evento de mensagens recebidas
    if (eventNormalized !== "MESSAGES_UPSERT") {
      console.log(`[EvolutionWebhook] Evento ignorado: ${payload.event}`);
      return;
    }

    const { key, message, messageType, pushName } = payload.data;

    // Detectar mensagens enviadas pelo OPERADOR (fromMe=true) para ativar modo humano
    if (key.fromMe) {
      // Verificar se é mensagem para um cliente (não para grupos)
      if (!key.remoteJid.includes("@g.us") && !key.remoteJid.includes("status")) {
        const clientPhone = extractPhoneFromJid(key.remoteJid);
        try {
          const db = await getDb();
          if (db) {
            const phoneDigits = clientPhone.slice(-11);
            const phoneLast8 = clientPhone.slice(-8);
            // Buscar cliente pelo telefone
            const [customer] = await db.select().from(customers).where(
              or(
                like(customers.phone, `%${phoneDigits}%`),
                like(customers.phone, `%${phoneLast8}%`)
              )
            ).limit(1);

            if (customer) {
              // Buscar conversa ativa
              const [conv] = await db.select().from(conversations)
                .where(eq(conversations.customerId, customer.id))
                .orderBy(conversations.createdAt)
                .limit(1);

              if (conv) {
                const humanModeUntil = new Date(Date.now() + 30 * 60 * 1000); // +30 minutos
                await db.update(conversations)
                  .set({ humanMode: true, humanModeUntil })
                  .where(eq(conversations.id, conv.id));
                console.log(`[EvolutionWebhook] Modo humano ativado para ${clientPhone} até ${humanModeUntil.toISOString()}`);
              }
            }
          }
        } catch (err) {
          console.error("[EvolutionWebhook] Erro ao ativar modo humano:", err);
        }
      }
      console.log("[EvolutionWebhook] Mensagem do operador processada (modo humano)");
      return;
    }

    // Ignorar mensagens de grupos
    if (key.remoteJid.includes("@g.us")) {
      console.log("[EvolutionWebhook] Mensagem de grupo ignorada:", key.remoteJid);
      return;
    }

    const phone = extractPhoneFromJid(key.remoteJid);
    const whatsappId = key.remoteJid; // Usar JID completo como ID único
    const messageId = key.id;

    console.log(`[EvolutionWebhook] Mensagem de ${phone} (${pushName || "sem nome"}) | Tipo: ${messageType}`);

    let messageText = "";

    // Extrair texto da mensagem conforme o tipo
    if (message?.conversation) {
      messageText = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      messageText = message.extendedTextMessage.text;
    } else if (message?.buttonsResponseMessage?.selectedDisplayText) {
      messageText = message.buttonsResponseMessage.selectedDisplayText;
    } else if (message?.listResponseMessage?.title) {
      messageText = message.listResponseMessage.title;
    } else if (message?.imageMessage?.caption) {
      messageText = message.imageMessage.caption || "[Imagem enviada]";
    } else if (message?.audioMessage || messageType === "audioMessage" || messageType === "pttMessage") {
      // Processar áudio: baixar e transcrever
      console.log(`[EvolutionWebhook] Áudio recebido, transcrevendo... ID: ${messageId}`);
      const transcription = await transcribeEvolutionAudio(messageId);
      if (transcription) {
        messageText = transcription;
        console.log(`[EvolutionWebhook] Áudio transcrito: "${messageText}"`);
      } else {
        messageText = "[Áudio recebido - não foi possível transcrever]";
      }
    } else if (message?.stickerMessage) {
      console.log("[EvolutionWebhook] Sticker ignorado");
      return;
    } else {
      console.log(`[EvolutionWebhook] Tipo de mensagem não suportado: ${messageType}`);
      return;
    }

    if (!messageText.trim()) {
      console.log("[EvolutionWebhook] Mensagem vazia, ignorando");
      return;
    }

    console.log(`[EvolutionWebhook] Processando: "${messageText.substring(0, 100)}..."`);

    // Processar mensagem pelo chatbot
    await processIncomingMessage(whatsappId, phone, messageText, messageId);

    console.log(`[EvolutionWebhook] Mensagem processada com sucesso`);
  } catch (error) {
    console.error("[EvolutionWebhook] Erro ao processar webhook:", error);
  }
}

/**
 * Transcreve um áudio recebido via Evolution API usando Whisper
 * Fluxo: Evolution API (base64) → S3 (URL pública) → Whisper (transcrição)
 */
async function transcribeEvolutionAudio(messageId: string): Promise<string | null> {
  try {
    // 1. Baixar o áudio em base64 via Evolution API
    const audioBuffer = await downloadMediaEvolution(messageId);

    if (!audioBuffer) {
      console.error("[EvolutionWebhook] Falha ao baixar áudio");
      return null;
    }

    console.log(`[EvolutionWebhook] Áudio baixado: ${audioBuffer.length} bytes`);

    // 2. Fazer upload para S3 para obter URL pública acessível pelo Whisper
    // O Whisper precisa de URL HTTP, não aceita arquivo local
    const s3Key = `audio-transcriptions/${messageId}-${Date.now()}.ogg`;
    let audioUrl: string;
    try {
      const uploaded = await storagePut(s3Key, audioBuffer, "audio/ogg");
      audioUrl = uploaded.url;
      console.log(`[EvolutionWebhook] Áudio enviado para S3: ${audioUrl}`);
    } catch (uploadErr) {
      console.error("[EvolutionWebhook] Falha ao enviar áudio para S3:", uploadErr);
      return null;
    }

    // 3. Transcrever com Whisper usando a URL do S3
    const result = await transcribeAudio({
      audioUrl,
      language: "pt",
      prompt: "Transcrição de mensagem de voz em português brasileiro para atendimento de restaurante",
    });

    if ("error" in result) {
      console.error("[EvolutionWebhook] Erro na transcrição:", result.error, result.details);
      return null;
    }

    const transcribed = result?.text?.trim() || null;
    console.log(`[EvolutionWebhook] Transcrição concluída: "${transcribed}"`);
    return transcribed;
  } catch (error) {
    console.error("[EvolutionWebhook] Erro ao transcrever áudio:", error);
    return null;
  }
}
