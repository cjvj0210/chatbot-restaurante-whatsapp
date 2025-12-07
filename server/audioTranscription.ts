import { getWhatsappSettings } from "./db";
import { transcribeAudio } from "./_core/voiceTranscription";

/**
 * Baixa e transcreve áudio do WhatsApp
 */
export async function transcribeWhatsAppAudio(audioId: string): Promise<string | null> {
  try {
    const settings = await getWhatsappSettings();
    
    if (!settings || !settings.accessToken) {
      console.error("[AudioTranscription] WhatsApp settings not configured");
      return null;
    }

    // 1. Obter URL do áudio
    const mediaUrlResponse = await fetch(
      `https://graph.facebook.com/v21.0/${audioId}`,
      {
        headers: {
          Authorization: `Bearer ${settings.accessToken}`,
        },
      }
    );

    if (!mediaUrlResponse.ok) {
      console.error("[AudioTranscription] Failed to get media URL:", await mediaUrlResponse.text());
      return null;
    }

    const mediaData = await mediaUrlResponse.json();
    const audioUrl = mediaData.url;

    if (!audioUrl) {
      console.error("[AudioTranscription] No URL in media response");
      return null;
    }

    // 2. Baixar áudio
    const audioResponse = await fetch(audioUrl, {
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
      },
    });

    if (!audioResponse.ok) {
      console.error("[AudioTranscription] Failed to download audio:", await audioResponse.text());
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
    console.log(`[AudioTranscription] Audio saved to ${tempFilePath}`);

    // 4. Transcrever usando Whisper API
    const result = await transcribeAudio({
      audioUrl: tempFilePath,
      language: "pt", // Português
    });

    // 5. Limpar arquivo temporário
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.warn("[AudioTranscription] Failed to delete temp file:", e);
    }

    // Verificar se a transcrição foi bem-sucedida
    if ('error' in result) {
      console.error("[AudioTranscription] Transcription error:", result.error);
      return null;
    }

    if (result && result.text) {
      return result.text;
    }

    return null;
  } catch (error) {
    console.error("[AudioTranscription] Error transcribing audio:", error);
    return null;
  }
}
