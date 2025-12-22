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
      // Validar tipo de arquivo
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
