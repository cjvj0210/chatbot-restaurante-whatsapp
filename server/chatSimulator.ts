import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getRestaurantSettings, getDb } from "./db";
import { getChatbotPrompt } from "./chatbotPrompt";
import { orderSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { getSiteUrl } from "./_core/siteUrl";

// Armazenamento em memória das conversas
const conversations = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

// Mapa de sessão de chat → sessão de pedido ativo
const chatOrderSessions = new Map<string, string>();

export const chatSimulatorRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { sessionId, message } = input;

      // Obter histórico da conversa
      let history = conversations.get(sessionId) || [];

      // Adicionar mensagem do usuário ao histórico
      history.push({ role: "user", content: message });

      // Obter data/hora atual para contexto
      const hoje = new Date();
      const diaSemana = hoje.toLocaleDateString("pt-BR", { weekday: "long" });
      const dataCompleta = hoje.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const horarioAtual = hoje.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Usar o prompt COMPLETO do restaurante (mesmo do WhatsApp real)
      const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

      // Preparar mensagens para a IA
      const aiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ];

      // Chamar IA
      const response = await invokeLLM({ messages: aiMessages });

      let assistantMessage =
        typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "Desculpe, não consegui processar sua mensagem.";

      // Processar GERAR_LINK_PEDIDO: criar sessão real e substituir pelo link
      let orderSessionId: string | null = null;
      if (assistantMessage.includes("[GERAR_LINK_PEDIDO]")) {
        try {
          const db = await getDb();
          if (db) {
            orderSessionId = randomBytes(16).toString("hex");
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await db.insert(orderSessions).values({
              sessionId: orderSessionId,
              whatsappNumber: null,
              customerId: null,
              status: "pending",
              expiresAt,
            });
            // Salvar mapeamento chat → pedido para polling
            chatOrderSessions.set(sessionId, orderSessionId);

            // Substituir placeholder com marcador especial que o frontend resolve
            // usando window.location.origin para garantir o domínio correto
            assistantMessage = assistantMessage.replace(
              "[GERAR_LINK_PEDIDO]",
              `[ORDER_LINK:${orderSessionId}]`
            );
          }
        } catch (err) {
          console.error("[Simulator] Erro ao gerar link de pedido:", err);
          assistantMessage = assistantMessage.replace(
            "[GERAR_LINK_PEDIDO]",
            "(link indisponível no momento)"
          );
        }
      }

      // Adicionar resposta ao histórico
      history.push({ role: "assistant", content: assistantMessage });

      // Limitar histórico a últimas 20 mensagens
      if (history.length > 20) {
        history = history.slice(-20);
      }

      // Salvar histórico atualizado
      conversations.set(sessionId, history);

      return {
        message: assistantMessage,
        orderSessionId,
        timestamp: new Date(),
      };
    }),

  resetConversation: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      conversations.delete(input.sessionId);
      chatOrderSessions.delete(input.sessionId);
      return { success: true };
    }),

  sendAudio: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
      })
    )
    .mutation(async ({ input }) => {
      const { sessionId, audioBase64, mimeType } = input;

      // Converter base64 para buffer
      const audioBuffer = Buffer.from(audioBase64, "base64");

      // Fazer upload do áudio para S3
      const fileKey = `audio-simulator/${sessionId}-${Date.now()}.webm`;
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, mimeType);

      // Transcrever áudio
      const transcription = await transcribeAudio({
        audioUrl,
        language: "pt",
      });

      const transcribedText = 'text' in transcription ? transcription.text : "";

      // Obter histórico da conversa
      let history = conversations.get(sessionId) || [];
      history.push({ role: "user", content: `[Áudio]: ${transcribedText}` });

      // Obter data/hora atual
      const hoje = new Date();
      const diaSemana = hoje.toLocaleDateString("pt-BR", { weekday: "long" });
      const dataCompleta = hoje.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const horarioAtual = hoje.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

      const aiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ];

      const response = await invokeLLM({ messages: aiMessages });

      let assistantMessage =
        typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "Desculpe, não consegui processar sua mensagem.";

      // Processar GERAR_LINK_PEDIDO também no áudio
      let orderSessionId: string | null = null;
      if (assistantMessage.includes("[GERAR_LINK_PEDIDO]")) {
        try {
          const db = await getDb();
          if (db) {
            orderSessionId = randomBytes(16).toString("hex");
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await db.insert(orderSessions).values({
              sessionId: orderSessionId,
              whatsappNumber: null,
              customerId: null,
              status: "pending",
              expiresAt,
            });
            chatOrderSessions.set(sessionId, orderSessionId);
            assistantMessage = assistantMessage.replace(
              "[GERAR_LINK_PEDIDO]",
              `[ORDER_LINK:${orderSessionId}]`
            );
          }
        } catch (err) {
          console.error("[Simulator] Erro ao gerar link de pedido (áudio):", err);
          assistantMessage = assistantMessage.replace(
            "[GERAR_LINK_PEDIDO]",
            "(link indisponível no momento)"
          );
        }
      }

      history.push({ role: "assistant", content: assistantMessage });
      if (history.length > 20) history = history.slice(-20);
      conversations.set(sessionId, history);

      return {
        message: assistantMessage,
        transcription: transcribedText,
        orderSessionId,
        timestamp: new Date(),
      };
    }),

  // Polling: verificar se um pedido foi finalizado no cardápio digital
  checkOrderStatus: publicProcedure
    .input(z.object({ orderSessionId: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return { status: "pending", order: null };

        const [session] = await db
          .select()
          .from(orderSessions)
          .where(eq(orderSessions.sessionId, input.orderSessionId))
          .limit(1);

        if (!session) return { status: "not_found", order: null };

        return {
          status: session.status,
        };
      } catch (err) {
        console.error("[Simulator] Erro ao verificar status do pedido:", err);
        return { status: "error", order: null };
      }
    }),
});
