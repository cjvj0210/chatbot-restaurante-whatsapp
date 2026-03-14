import { getWhatsappSettings } from "./db";
import { transcribeAudio } from "./_core/voiceTranscription";
import { logger } from "./utils/logger";

/**
 * Baixa e transcreve áudio do WhatsApp
 */
export async function transcribeWhatsAppAudio(audioId: string): Promise<string | null> {
  try {
    const settings = await getWhatsappSettings();
    
    if (!settings || !settings.accessToken) {
      logger.warn("AudioTranscription", "WhatsApp settings not configured");
      return null;
    }

    // 1. Obter URL do áudio
    const mediaController = new AbortController();
    const mediaTimeoutId = setTimeout(() => mediaController.abort(), 15_000);
    let mediaUrlResponse: Response;
    try {
      mediaUrlResponse = await fetch(
        `https://graph.facebook.com/v21.0/${audioId}`,
        {
          headers: { Authorization: `Bearer ${settings.accessToken}` },
          signal: mediaController.signal,
        }
      );
    } finally {
      clearTimeout(mediaTimeoutId);
    }

    if (!mediaUrlResponse.ok) {
      logger.warn("AudioTranscription", `Failed to get media URL: ${await mediaUrlResponse.text()}`);
      return null;
    }

    const mediaData = await mediaUrlResponse.json();
    const audioUrl = mediaData.url;

    if (!audioUrl) {
      logger.error("AudioTranscription", "No URL in media response", null);
      return null;
    }

    // 2. Baixar áudio
    const audioController = new AbortController();
    const audioTimeoutId = setTimeout(() => audioController.abort(), 15_000);
    let audioResponse: Response;
    try {
      audioResponse = await fetch(audioUrl, {
        headers: { Authorization: `Bearer ${settings.accessToken}` },
        signal: audioController.signal,
      });
    } finally {
      clearTimeout(audioTimeoutId);
    }

    if (!audioResponse.ok) {
      logger.warn("AudioTranscription", `Failed to download audio: ${await audioResponse.text()}`);
      return null;
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    
    // 3. Salvar temporariamente
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `whatsapp-audio-${audioId}.ogg`);
    
    fs.writeFileSync(tempFilePath, Buffer.from(audioBuffer));
    logger.info("AudioTranscription", `Audio saved to ${tempFilePath}`);

    // 4. Transcrever usando Whisper API
    const result = await transcribeAudio({
      audioUrl: tempFilePath,
      language: "pt", // Português
    });

    // 5. Limpar arquivo temporário
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      logger.warn("AudioTranscription", "Failed to delete temp file", cleanupError);
    }

    // Verificar se a transcrição foi bem-sucedida
    if ('error' in result) {
      logger.error("AudioTranscription", `Transcription error: ${result.error}`, null);
      return null;
    }

    if (result && result.text) {
      return result.text;
    }

    return null;
  } catch (error) {
    logger.error("AudioTranscription", `Error transcribing audio ${audioId}`, error);
    return null;
  }
}
