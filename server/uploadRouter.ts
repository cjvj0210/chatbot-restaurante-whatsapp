import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { storagePut } from "./storage";

/**
 * Router para upload de arquivos
 */
export const uploadRouter = router({
  /**
   * Upload de imagem para item do cardápio
   */
  uploadMenuItemImage: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Validar tipo de arquivo declarado (allowlist — sem SVG que pode conter scripts)
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowedTypes.includes(input.mimeType)) {
        throw new Error("Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.");
      }

      // Converter base64 para Buffer
      const base64Data = input.fileData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Validar tamanho (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxSize) {
        throw new Error("Arquivo muito grande. Tamanho máximo: 5MB");
      }

      // SEGURANÇA: validar magic bytes reais do arquivo (previne polyglot e spoofing de MIME)
      // JPEG: FF D8 FF | PNG: 89 50 4E 47 | WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isWebp = buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP";
      if (!isJpeg && !isPng && !isWebp) {
        throw new Error("Conteúdo do arquivo não corresponde ao tipo declarado.");
      }

      // Gerar nome único para o arquivo
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const ext = input.mimeType.split("/")[1];
      const fileKey = `menu-items/${timestamp}-${randomSuffix}.${ext}`;

      // Upload para S3
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      return {
        url,
        fileKey,
      };
    }),
});
