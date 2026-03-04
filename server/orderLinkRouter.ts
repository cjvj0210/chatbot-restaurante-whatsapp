import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { orderSessions } from "../drizzle/schema";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getSiteUrl } from "./_core/siteUrl";

/**
 * Router para geração de links únicos de pedido
 */
export const orderLinkRouter = router({
  /**
   * Gera um link único para o cardápio web
   * Usado pelo bot quando cliente quer fazer pedido
   */
  generate: publicProcedure
    .input(
      z.object({
        whatsappNumber: z.string().optional(),
        customerId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { whatsappNumber, customerId } = input;

      // Gerar sessionId único
      const sessionId = randomBytes(16).toString("hex");

      // Link expira em 24 horas
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Salvar sessão no banco
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      await db.insert(orderSessions).values({
        sessionId,
        whatsappNumber: whatsappNumber || null,
        customerId: customerId || null,
        status: "pending",
        expiresAt,
      });

      // Gerar URL completa
      const orderLink = `${getSiteUrl()}/pedido/${sessionId}`;

      return {
        sessionId,
        orderLink,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  /**
   * Valida se um sessionId ainda é válido
   */
  validate: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { sessionId } = input;

      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      const [session] = await db
        .select()
        .from(orderSessions)
        .where(eq(orderSessions.sessionId, sessionId))
        .limit(1);

      if (!session) {
        return {
          valid: false,
          reason: "session_not_found",
        };
      }

      // Verificar se expirou
      if (new Date() > new Date(session.expiresAt)) {
        return {
          valid: false,
          reason: "session_expired",
        };
      }

      // Verificar se já foi usado
      if (session.status === "completed") {
        return {
          valid: false,
          reason: "session_already_used",
        };
      }

      return {
        valid: true,
        session: {
          id: session.id,
          sessionId: session.sessionId,
          whatsappNumber: session.whatsappNumber,
          expiresAt: session.expiresAt.toISOString(),
        },
      };
    }),
});
