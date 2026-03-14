import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { logger } from "./utils/logger";
import { getRestaurantSettings, getDb } from "./db";
import { getChatbotPrompt } from "./chatbotPrompt";
import { getBRTDateTimeFormatted } from "../shared/businessHours";
import { orderSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { getSiteUrl } from "./_core/siteUrl";
import { notifyOwner } from "./_core/notification";
import { reservations } from "../drizzle/schema";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas de inatividade

interface ConversationSession {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  lastAccessAt: number;
}

// Armazenamento em memória das conversas com timestamp de último acesso
const conversations = new Map<string, ConversationSession>();

// Mapa de sessão de chat → sessão de pedido ativo
const chatOrderSessions = new Map<string, string>();

// Limpeza periódica de sessões inativas há mais de 24 horas
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of conversations.entries()) {
    if (now - session.lastAccessAt > SESSION_TTL_MS) {
      conversations.delete(id);
      chatOrderSessions.delete(id);
    }
  }
}, 60 * 60 * 1000); // Verificar a cada 1 hora

// Processa e salva reserva detectada na resposta do bot
async function processReservationMarker(message: string): Promise<string> {
  const reservaRegex = /\[SALVAR_RESERVA:([^\]]+)\]/;
  const match = message.match(reservaRegex);
  if (!match) return message;

  try {
    const params: Record<string, string> = {};
    match[1]!.split(';').forEach(pair => {
      const [key, ...rest] = pair.split('=');
      if (key) params[key.trim()] = rest.join('=').trim();
    });

    const db = await getDb();
    if (db) {
      const dateStr = new Date().toISOString().slice(0, 8).replace(/-/g, '');
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const reservationNumber = `RES-${dateStr}-${suffix}`;

      // Tentar parsear a data da reserva
      let reservationDate = new Date();
      try {
        if (params.data) {
          // Tentar parsear formatos comuns
          const parsed = new Date(params.data);
          if (!isNaN(parsed.getTime())) reservationDate = parsed;
        }
      } catch {}

      await db.insert(reservations).values({
        customerId: null,
        reservationNumber,
        customerName: params.nome || 'Cliente via chat',
        customerPhone: params.telefone || '',
        date: reservationDate,
        numberOfPeople: parseInt(params.pessoas || '1', 10),
        customerNotes: params.obs && params.obs !== 'OBSERVACOES' ? params.obs : null,
        status: 'pending',
        source: 'chatbot',
      });

      // Notificar o dono
      await notifyOwner({
        title: `📝 Nova reserva via Chat de Teste`,
        content: `Nome: ${params.nome || '-'}\nTelefone: ${params.telefone || '-'}\nData/Hora: ${params.data || '-'}\nPessoas: ${params.pessoas || '-'}\nObs: ${params.obs && params.obs !== 'OBSERVACOES' ? params.obs : '-'}`,
      }).catch((err: unknown) => { logger.warn("Simulator", "Falha ao notificar dono sobre reserva de teste", err); });
    }
  } catch (err) {
    console.error('[Simulator] Erro ao salvar reserva:', err);
  }

  // Remover o marcador da mensagem exibida ao cliente
  return message.replace(reservaRegex, '').replace(/\n{3,}/g, '\n\n').trim();
}

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
      const session = conversations.get(sessionId);
      let history = session?.history || [];

      // Adicionar mensagem do usuário ao histórico
      history.push({ role: "user", content: message });

      // Obter data/hora atual para contexto (fuso Brasília UTC-3) — com cache de 500ms
      const { diaSemana, dataCompleta, horarioAtual } = getBRTDateTimeFormatted();

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
      let response: Awaited<ReturnType<typeof invokeLLM>>;
      try {
        response = await invokeLLM({ messages: aiMessages });
      } catch (llmError) {
        logger.error("ChatSimulator", "Falha ao chamar invokeLLM (sendMessage)", llmError);
        return {
          message: "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em instantes. 🙏",
          orderSessionId: null,
          timestamp: new Date(),
        };
      }

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

      // Processar SALVAR_RESERVA: salvar no banco e notificar o dono
      if (assistantMessage.includes('[SALVAR_RESERVA:')) {
        assistantMessage = await processReservationMarker(assistantMessage);
      }

      // Adicionar resposta ao histórico
      history.push({ role: "assistant", content: assistantMessage });

      // Limitar histórico a últimas 20 mensagens
      if (history.length > 20) {
        history = history.slice(-20);
      }

      // Salvar histórico atualizado com timestamp de acesso
      conversations.set(sessionId, { history, lastAccessAt: Date.now() });

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
      const audioSession = conversations.get(sessionId);
      let history = audioSession?.history || [];
      history.push({ role: "user", content: `[Áudio]: ${transcribedText}` });

      // Obter data/hora atual (fuso Brasília UTC-3) — com cache de 500ms
      const { diaSemana: dS, dataCompleta: dC, horarioAtual: hA } = getBRTDateTimeFormatted();

      const systemPrompt = getChatbotPrompt(dS, dC, hA);

      const aiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ];

      let response: Awaited<ReturnType<typeof invokeLLM>>;
      try {
        response = await invokeLLM({ messages: aiMessages });
      } catch (llmError) {
        logger.error("ChatSimulator", "Falha ao chamar invokeLLM (sendAudio)", llmError);
        return {
          message: "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em instantes. 🙏",
          transcription: transcribedText,
          orderSessionId: null,
          timestamp: new Date(),
        };
      }

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

      // Processar SALVAR_RESERVA no fluxo de áudio
      if (assistantMessage.includes('[SALVAR_RESERVA:')) {
        assistantMessage = await processReservationMarker(assistantMessage);
      }

      history.push({ role: "assistant", content: assistantMessage });
      if (history.length > 20) history = history.slice(-20);
      conversations.set(sessionId, { history, lastAccessAt: Date.now() });

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
