import type { Request, Response } from "express";
import { processIncomingMessage } from "./chatbot";
import { sendTextMessageEvolution, downloadMediaEvolution } from "./evolutionApi";
import { transcribeAudio } from "./_core/voiceTranscription";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

    console.log("[EvolutionWebhook] Evento recebido:", payload.event, "| Instância:", payload.instance);

    // Só processar evento de mensagens recebidas
    if (payload.event !== "messages.upsert") {
      return;
    }

    const { key, message, messageType, pushName } = payload.data;

    // Ignorar mensagens enviadas pelo próprio bot
    if (key.fromMe) {
      console.log("[EvolutionWebhook] Mensagem própria ignorada");
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
 */
async function transcribeEvolutionAudio(messageId: string): Promise<string | null> {
  try {
    // Baixar o áudio em base64 via Evolution API
    const audioBuffer = await downloadMediaEvolution(messageId);

    if (!audioBuffer) {
      console.error("[EvolutionWebhook] Falha ao baixar áudio");
      return null;
    }

    // Salvar temporariamente como .ogg
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `evolution-audio-${messageId}.ogg`);

    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log(`[EvolutionWebhook] Áudio salvo em ${tempFilePath} (${audioBuffer.length} bytes)`);

    // Transcrever com Whisper
    const result = await transcribeAudio({
      audioUrl: tempFilePath,
      language: "pt",
    });

    // Limpar arquivo temporário
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.warn("[EvolutionWebhook] Falha ao deletar arquivo temporário:", e);
    }

    if ("error" in result) {
      console.error("[EvolutionWebhook] Erro na transcrição:", result.error);
      return null;
    }

    return result?.text || null;
  } catch (error) {
    console.error("[EvolutionWebhook] Erro ao transcrever áudio:", error);
    return null;
  }
}
