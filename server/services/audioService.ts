/**
 * Audio transcription service
 * Centralizes duplicated transcription logic from webhookEvolution.ts and messagePolling.ts
 */
import axios from "axios";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";
import { downloadMediaEvolution } from "../evolutionApi";
import { logger } from "../utils/logger";

/**
 * Transcribes audio received via Evolution API using Whisper
 * Flow: Evolution API (base64) → S3 (public URL) → Whisper (transcription)
 */
export async function transcribeFromEvolution(messageId: string): Promise<string | null> {
  try {
    const audioBuffer = await downloadMediaEvolution(messageId);
    if (!audioBuffer) {
      logger.warn("AudioService", `Failed to download audio for message ${messageId}`);
      return null;
    }

    const s3Key = `audio-transcriptions/${messageId}-${Date.now()}.ogg`;
    let audioUrl: string;
    try {
      const uploaded = await storagePut(s3Key, audioBuffer, "audio/ogg");
      audioUrl = uploaded.url;
    } catch (uploadErr) {
      logger.error("AudioService", "Failed to upload audio to S3", uploadErr);
      return null;
    }

    const result = await transcribeAudio({
      audioUrl,
      language: "pt",
      prompt: "Transcrição de mensagem de voz em português brasileiro para atendimento de restaurante",
    });

    if ("error" in result) {
      logger.error("AudioService", `Transcription error for ${messageId}`, result.error);
      return null;
    }

    return result?.text?.trim() || null;
  } catch (error) {
    logger.error("AudioService", `Unexpected error transcribing ${messageId}`, error);
    return null;
  }
}

/**
 * Transcribes audio from Evolution API polling endpoint (uses different download method)
 */
export async function transcribeFromPolling(
  messageId: string,
  baseUrl: string,
  apiKey: string,
  instanceName: string
): Promise<string | null> {
  try {
    const response = await axios.post(
      `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      { message: { key: { id: messageId } }, convertToMp4: false },
      { headers: { apikey: apiKey, "Content-Type": "application/json" }, timeout: 30000 }
    );

    if (!response.data?.base64) return null;

    const base64Data = response.data.base64.replace(/^data:[^;]+;base64,/, "");
    const audioBuffer = Buffer.from(base64Data, "base64");

    const s3Key = `audio-transcriptions/${messageId}-${Date.now()}.ogg`;
    const uploaded = await storagePut(s3Key, audioBuffer, "audio/ogg");

    const result = await transcribeAudio({
      audioUrl: uploaded.url,
      language: "pt",
      prompt: "Transcrição de mensagem de voz em português brasileiro para atendimento de restaurante",
    });

    if ("error" in result) return null;
    return result?.text?.trim() || null;
  } catch (error) {
    logger.error("AudioService", `Erro ao transcrever áudio ${messageId} via polling`, error);
    return null;
  }
}
