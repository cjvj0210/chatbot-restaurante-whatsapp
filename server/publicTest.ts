import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getRestaurantSettings, getDb } from "./db";
import { getChatbotPrompt } from "./chatbotPrompt";
import { testSessions, testMessages } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Armazenamento em memória das conversas de teste (para contexto)
const testConversations = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

export const publicTestRouter = router({
  sendMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { sessionId, message } = input;

      // Criar ou atualizar sessão no banco de dados
      const db = await getDb();
      if (!db) {
        throw new Error('Banco de dados não disponível');
      }
      const existingSession = await db.select().from(testSessions).where(eq(testSessions.sessionId, sessionId)).limit(1);
      
      if (existingSession.length === 0) {
        await db.insert(testSessions).values({
          sessionId,
          userAgent: null, // Pode ser capturado do header no futuro
          ipAddress: null, // Pode ser capturado do header no futuro
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

      // Obter data e HORÁRIO atual para contexto
      const agora = new Date();
      const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dataCompleta = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const horarioAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // System prompt completo (compartilhado com simulador)
      const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

      // Chamar LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      });

      const botMessageContent = response.choices[0]?.message?.content;
      const botMessage = typeof botMessageContent === 'string' 
        ? botMessageContent 
        : "Desculpe, não consegui processar sua mensagem.";

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
        audioBase64: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { sessionId, audioBase64, mimeType } = input;

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

      // Obter data e HORÁRIO atual para contexto
      const agora = new Date();
      const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long' });
      const dataCompleta = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const horarioAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // System prompt completo (compartilhado com simulador)
      const systemPrompt = getChatbotPrompt(diaSemana, dataCompleta, horarioAtual);

      // Chamar LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      });

      const botMessageContent = response.choices[0]?.message?.content;
      const botMessage = typeof botMessageContent === 'string' 
        ? botMessageContent 
        : "Desculpe, não consegui processar sua mensagem.";

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
