/**
 * Rate limiter por whatsappId para o chatbot
 * Previne abuso: máximo de 30 mensagens por hora por número
 *
 * Implementação: conta mensagens role='user' na tabela `messages`
 * nas últimas 1h para o whatsappId dado, via JOIN conversations → customers.
 * Se o banco não estiver disponível, usa fallback em memória (fail-open dentro do limite).
 */

import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "./db";
import { messages, conversations, customers } from "../drizzle/schema";
import { CHATBOT } from "../shared/constants";
import { logger } from "./utils/logger";

const WINDOW_MS = CHATBOT.RATE_LIMIT_WINDOW_MS;
const MAX_MESSAGES = CHATBOT.RATE_LIMIT_MAX_MESSAGES;

// Fallback em memória para quando o banco não está disponível
interface RateLimitEntry {
  count: number;
  windowStart: number;
}
const rateLimitsMemory = new Map<string, RateLimitEntry>();

/**
 * Verifica se o whatsappId pode enviar mais mensagens (async — usa banco de dados)
 * @returns true se permitido, false se bloqueado
 */
export async function checkChatbotRateLimit(whatsappId: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      // Fallback em memória se banco indisponível
      return checkMemoryRateLimit(whatsappId);
    }

    const windowStart = new Date(Date.now() - WINDOW_MS);

    const result = await db
      .select({ total: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(customers, eq(conversations.customerId, customers.id))
      .where(
        and(
          eq(customers.whatsappId, whatsappId),
          eq(messages.role, "user"),
          gte(messages.createdAt, windowStart)
        )
      );

    return (result[0]?.total ?? 0) < MAX_MESSAGES;
  } catch {
    // Fallback em memória em caso de erro
    return checkMemoryRateLimit(whatsappId);
  }
}

/**
 * Fallback em memória — usado quando o banco não está disponível
 */
function checkMemoryRateLimit(whatsappId: string): boolean {
  const now = Date.now();
  const entry = rateLimitsMemory.get(whatsappId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitsMemory.set(whatsappId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_MESSAGES) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Retorna quantas mensagens restam na janela (usa fallback em memória para compatibilidade de testes)
 */
export function getRemainingMessages(whatsappId: string): number {
  const now = Date.now();
  const entry = rateLimitsMemory.get(whatsappId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    return MAX_MESSAGES;
  }

  return Math.max(0, MAX_MESSAGES - entry.count);
}

/**
 * Limpa entradas expiradas do fallback em memória (chamar periodicamente)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;
  const keys = Array.from(rateLimitsMemory.keys());
  for (const key of keys) {
    const entry = rateLimitsMemory.get(key);
    if (entry && now - entry.windowStart > WINDOW_MS) {
      rateLimitsMemory.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info("RateLimit", `Limpou ${cleaned} entradas expiradas`);
  }
}
