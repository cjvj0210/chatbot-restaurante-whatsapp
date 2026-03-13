import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getRestaurantSettings, getDb } from "./db";
import { getChatbotPrompt } from "./chatbotPrompt";
import { testSessions, testMessages, orderSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

// Armazenamento em memória das conversas de teste (para contexto)
const testConversations = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

// Rate limiting por IP para endpoints públicos de IA (proteção contra abuso de LLM)
// Máximo de 20 mensagens por hora por IP
const publicTestRateLimits = new Map<string, { count: number; windowStart: number }>();
const PUBLIC_TEST_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const PUBLIC_TEST_MAX_MSGS = 20;

function checkPublicTestRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = publicTestRateLimits.get(ip);
  if (!entry || (now - entry.windowStart) > PUBLIC_TEST_WINDOW_MS) {
    publicTestRateLimits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= PUBLIC_TEST_MAX_MSGS) return false;
  entry.count++;
  return true;
}

// Tamanho máximo de áudio base64 (~10MB de áudio ≈ ~13.5MB base64)
const MAX_AUDIO_BASE64_LEN = 14 * 1024 * 1024;

export const publicTestRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionId, message } = input;

      // Rate limiting por IP para proteger recursos de LLM
      const clientIp = ctx.req?.ip || ctx.req?.socket?.remoteAddress || "unknown";
      if (!checkPublicTestRateLimit(clientIp)) {
        throw new Error("Limite de mensagens atingido. Tente novamente em 1 hora.");
      }

      // Criar ou atualizar sessão no banco de dados
      const db = await getDb();
      if (!db) {
        throw new Error('Banco de dados não disponível');
      }
      const existingSession = await db.select().from(testSessions).where(eq(testSessions.sessionId, sessionId)).limit(1);

      if (existingSession.length === 0) {
        await db.insert(testSessions).values({
          sessionId,
          userAgent: ctx.req?.headers?.["user-agent"] as string ?? null,
          ipAddress: clientIp,
        });
      }

      // Salvar mensagem do usuário no banco
      await db.insert(testMessages).values({
        sessionId,
        role: "user",
        content: message,
        messageType: "text",
      });

      // Buscar informações do restaurante
      const settings = await getRestaurantSettings();
      if (!settings) {
        throw new Error('Configurações do restaurante não encontradas');
      }

      // Obter histórico da conversa
      let history = testConversations.get(sessionId) || [];

      // Adicionar mensagem do usuário ao histórico
      history.push({ role: "user", content: message });

      // Obter data e HORÁRIO atual para contexto (fuso Brasília UTC-3)
      const agora = new Date();
      const tzBrasilia = 'America/Sao_Paulo';
      const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: tzBrasilia });
      const dataCompleta = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: tzBrasilia });
      const horarioAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tzBrasilia });

      // System prompt completo (compartilhado com simulador)
      const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

      // Chamar LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      });

      let botMessageContent = response.choices[0]?.message?.content;
      let botMessage = typeof botMessageContent === 'string' 
        ? botMessageContent 
        : "Desculpe, não consegui processar sua mensagem.";

      // Detectar se bot quer gerar link de pedido
      if (botMessage.includes('[GERAR_LINK_PEDIDO]')) {
        // Gerar link único de pedido
        const sessionIdPedido = randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        await db.insert(orderSessions).values({
          sessionId: sessionIdPedido,
          whatsappNumber: null, // Não temos WhatsApp no teste
          customerId: null,
          status: 'pending',
          expiresAt,
        });

        // Gerar URL do cardápio (usar host da requisição atual)
        const protocol = ctx.req.protocol || 'http';
        const host = ctx.req.get('host') || 'localhost:3000';
        const orderLink = `${protocol}://${host}/pedido/${sessionIdPedido}`;

        // Substituir placeholder pelo link real
        // Garante que o link fique em linha isolada (iOS exige URL sozinha na linha para ser clicavel)
        botMessage = botMessage.replace(/\[GERAR_LINK_PEDIDO\]/g, `\n${orderLink}\n`);
        // Limpar linhas em branco duplas excessivas
        botMessage = botMessage.replace(/\n{3,}/g, '\n\n');
      }

      // Adicionar resposta do bot ao histórico
      history.push({ role: "assistant", content: botMessage });

      // Salvar histórico atualizado
      testConversations.set(sessionId, history);

      // Salvar resposta do bot no banco
      await db.insert(testMessages).values({
        sessionId,
        role: "assistant",
        content: botMessage,
        messageType: "text",
      });

      return {
        message: botMessage,
        timestamp: new Date(),
      };
    }),

  sendAudio: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        audioBase64: z.string().max(MAX_AUDIO_BASE64_LEN, "Áudio muito grande. Máximo: ~10MB"),
        mimeType: z.enum(["audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/mpeg"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionId, audioBase64, mimeType } = input;

      // Rate limiting por IP
      const clientIp = ctx.req?.ip || ctx.req?.socket?.remoteAddress || "unknown";
      if (!checkPublicTestRateLimit(clientIp)) {
        throw new Error("Limite de mensagens atingido. Tente novamente em 1 hora.");
      }

      // Criar ou atualizar sessão no banco de dados
      const db = await getDb();
      if (!db) {
        throw new Error('Banco de dados não disponível');
      }
      const existingSession = await db.select().from(testSessions).where(eq(testSessions.sessionId, sessionId)).limit(1);
      
      if (existingSession.length === 0) {
        await db.insert(testSessions).values({
          sessionId,
          userAgent: null,
          ipAddress: null,
        });
      }

      // Converter base64 para buffer
      const audioBuffer = Buffer.from(audioBase64, "base64");

      // Fazer upload do áudio para S3
      const { storagePut } = await import("./storage");
      const audioKey = `audio-test/${sessionId}-${Date.now()}.webm`;
      const { url: audioUrl } = await storagePut(audioKey, audioBuffer, mimeType);

      // Transcrever áudio
      const { transcribeAudio } = await import("./_core/voiceTranscription");
      const transcription = await transcribeAudio({
        audioUrl,
        language: "pt",
      });

      // Verificar se a transcrição foi bem-sucedida
      if (!('text' in transcription)) {
        throw new Error('Erro ao transcrever áudio');
      }
      const transcribedText = transcription.text;

      // Salvar mensagem de áudio do usuário no banco
      await db.insert(testMessages).values({
        sessionId,
        role: "user",
        content: transcribedText,
        messageType: "audio",
        audioUrl,
        transcription: transcribedText,
      });

      // Buscar informações do restaurante
      const settings = await getRestaurantSettings();
      if (!settings) {
        throw new Error('Configurações do restaurante não encontradas');
      }

      // Obter histórico da conversa
      let history = testConversations.get(sessionId) || [];

      // Adicionar mensagem transcrita ao histórico
      history.push({ role: "user", content: transcribedText });

      // Obter data e HORÁRIO atual para contexto (fuso Brasília UTC-3)
      const agora = new Date();
      const tzBrasilia = 'America/Sao_Paulo';
      const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: tzBrasilia });
      const dataCompleta = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: tzBrasilia });
      const horarioAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tzBrasilia });

      // System prompt completo (compartilhado com simulador)
      const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

      // Chamar LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      });

      let botMessageContent = response.choices[0]?.message?.content;
      let botMessage = typeof botMessageContent === 'string' 
        ? botMessageContent 
        : "Desculpe, não consegui processar sua mensagem.";

      // Detectar se bot quer gerar link de pedido
      if (botMessage.includes('[GERAR_LINK_PEDIDO]')) {
        // Gerar link único de pedido
        const sessionIdPedido = randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        await db.insert(orderSessions).values({
          sessionId: sessionIdPedido,
          whatsappNumber: null, // Não temos WhatsApp no teste
          customerId: null,
          status: 'pending',
          expiresAt,
        });

        // Gerar URL do cardápio (usar host da requisição atual)
        const protocol = ctx.req.protocol || 'http';
        const host = ctx.req.get('host') || 'localhost:3000';
        const orderLink = `${protocol}://${host}/pedido/${sessionIdPedido}`;

        // Substituir placeholder pelo link real
        // Garante que o link fique em linha isolada (iOS exige URL sozinha na linha para ser clicavel)
        botMessage = botMessage.replace(/\[GERAR_LINK_PEDIDO\]/g, `\n${orderLink}\n`);
        // Limpar linhas em branco duplas excessivas
        botMessage = botMessage.replace(/\n{3,}/g, '\n\n');
      }

      // Adicionar resposta do bot ao histórico
      history.push({ role: "assistant", content: botMessage });

      // Salvar histórico atualizado
      testConversations.set(sessionId, history);

      // Salvar resposta do bot no banco
      await db.insert(testMessages).values({
        sessionId,
        role: "assistant",
        content: botMessage,
        messageType: "text",
      });

      return {
        message: botMessage,
        transcription: transcribedText,
        timestamp: new Date(),
      };
    }),
});
