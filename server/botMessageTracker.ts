/**
 * Bot Message Tracker
 *
 * Registra os IDs de mensagens enviadas pelo bot via Evolution API.
 * Usado para distinguir mensagens do BOT de mensagens do OPERADOR humano.
 *
 * Quando o webhook recebe uma mensagem fromMe=true:
 *   - Se o ID está registrado aqui → foi o BOT que enviou → ignorar
 *   - Se o ID NÃO está registrado → foi o OPERADOR que digitou → ativar modo humano
 *
 * Implementação: usa a tabela `processed_messages` com source='bot_sent'
 * para rastreamento distribuído entre múltiplas instâncias (dev + produção).
 * Fallback para Map em memória quando o banco não está disponível.
 */

import { getDb } from "./db";
import { processedMessages } from "../drizzle/schema";
import { and, eq, lt } from "drizzle-orm";

// Fallback em memória (TTL 60 min) para quando o banco não está disponível
const botSentMessagesMemory = new Map<string, number>();
const MESSAGE_TTL_MS = 60 * 60 * 1000; // 60 minutos
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

const BOT_SENT_SOURCE = "bot_sent";

/**
 * Registra um ID de mensagem como enviada pelo bot.
 * Deve ser chamada IMEDIATAMENTE após o envio bem-sucedido via Evolution API.
 */
export async function registerBotSentMessage(messageId: string): Promise<void> {
  if (!messageId) return;

  // Sempre registrar em memória como fallback imediato
  botSentMessagesMemory.set(messageId, Date.now());

  try {
    const db = await getDb();
    if (!db) return;

    // INSERT IGNORE — se já existir, silenciosamente ignora
    await db
      .insert(processedMessages)
      .ignore()
      .values({
        messageId: `bot:${messageId}`,
        source: BOT_SENT_SOURCE,
      });

    console.log(`[BotTracker] Mensagem registrada no banco: ${messageId}`);
  } catch {
    // Silenciosamente — o fallback em memória já está registrado
  }
}

/**
 * Verifica se uma mensagem foi enviada pelo bot.
 * Retorna true se o ID está registrado (= mensagem do bot).
 * Retorna false se o ID NÃO está registrado (= mensagem do operador humano).
 */
export async function isBotSentMessage(messageId: string): Promise<boolean> {
  // Checar memória primeiro (acesso instantâneo)
  if (botSentMessagesMemory.has(messageId)) {
    return true;
  }

  // Checar banco (para instâncias cruzadas — ex: enviado por outra instância)
  try {
    const db = await getDb();
    if (!db) return false;

    const [row] = await db
      .select({ id: processedMessages.id })
      .from(processedMessages)
      .where(
        and(
          eq(processedMessages.messageId, `bot:${messageId}`),
          eq(processedMessages.source, BOT_SENT_SOURCE)
        )
      )
      .limit(1);

    if (row) {
      // Preencher cache em memória para futuras verificações
      botSentMessagesMemory.set(messageId, Date.now());
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Remove mensagens expiradas do tracker em memória.
 * Chamada automaticamente pelo intervalo de limpeza.
 */
async function cleanupExpiredMessages(): Promise<void> {
  const now = Date.now();
  let removed = 0;
  const entries = Array.from(botSentMessagesMemory.entries());
  for (const [id, timestamp] of entries) {
    if (now - timestamp > MESSAGE_TTL_MS) {
      botSentMessagesMemory.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(
      `[BotTracker] Limpeza memória: ${removed} mensagens expiradas removidas (restam: ${botSentMessagesMemory.size})`
    );
  }

  // Limpar entradas antigas no banco também
  try {
    const db = await getDb();
    if (!db) return;
    const cutoff = new Date(Date.now() - MESSAGE_TTL_MS);
    await db
      .delete(processedMessages)
      .where(
        and(
          eq(processedMessages.source, BOT_SENT_SOURCE),
          lt(processedMessages.processedAt, cutoff)
        )
      );
  } catch {
    // Silenciosamente ignorar erros de limpeza
  }
}

/**
 * Retorna estatísticas do tracker para diagnóstico.
 */
export function getTrackerStats(): { totalTracked: number; oldestAge: number | null } {
  if (botSentMessagesMemory.size === 0) return { totalTracked: 0, oldestAge: null };

  const now = Date.now();
  let oldest = now;
  const values = Array.from(botSentMessagesMemory.values());
  for (const timestamp of values) {
    if (timestamp < oldest) oldest = timestamp;
  }

  return {
    totalTracked: botSentMessagesMemory.size,
    oldestAge: Math.round((now - oldest) / 1000),
  };
}

// Iniciar limpeza automática
setInterval(cleanupExpiredMessages, CLEANUP_INTERVAL_MS);
