import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { testSessions, testMessages } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const testConversationsRouter = router({
  getSessions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Banco de dados não disponível');
    }

    // Buscar todas as sessões com contagem de mensagens
    const sessions = await db
      .select({
        id: testSessions.id,
        sessionId: testSessions.sessionId,
        userAgent: testSessions.userAgent,
        ipAddress: testSessions.ipAddress,
        startedAt: testSessions.startedAt,
        lastActivityAt: testSessions.lastActivityAt,
        messageCount: sql<number>`(
          SELECT COUNT(*) 
          FROM ${testMessages} 
          WHERE ${testMessages.sessionId} = ${testSessions.sessionId}
        )`,
        hasAudio: sql<boolean>`(
          SELECT COUNT(*) > 0
          FROM ${testMessages}
          WHERE ${testMessages.sessionId} = ${testSessions.sessionId}
          AND ${testMessages.messageType} = 'audio'
        )`,
      })
      .from(testSessions)
      .orderBy(desc(testSessions.lastActivityAt));

    return sessions;
  }),

  getMessages: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error('Banco de dados não disponível');
      }

      const messages = await db
        .select()
        .from(testMessages)
        .where(eq(testMessages.sessionId, input.sessionId))
        .orderBy(testMessages.createdAt);

      return messages;
    }),
});
