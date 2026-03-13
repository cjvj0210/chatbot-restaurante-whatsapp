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
 * Usa um Map com TTL para auto-limpeza (IDs expiram após 60 minutos).
 */

// Map de messageId → timestamp de quando foi registrado
const botSentMessages = new Map<string, number>();

// TTL: 60 minutos (tempo suficiente para o webhook processar)
const MESSAGE_TTL_MS = 60 * 60 * 1000;

// Limpeza automática a cada 10 minutos
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Registra um ID de mensagem como enviada pelo bot.
 * Deve ser chamada IMEDIATAMENTE após o envio bem-sucedido via Evolution API.
 */
export function registerBotSentMessage(messageId: string): void {
  if (!messageId) return;
  botSentMessages.set(messageId, Date.now());
  console.log(`[BotTracker] Mensagem registrada: ${messageId} (total: ${botSentMessages.size})`);
}

/**
 * Verifica se uma mensagem foi enviada pelo bot.
 * Retorna true se o ID está registrado (= mensagem do bot).
 * Retorna false se o ID NÃO está registrado (= mensagem do operador humano).
 */
export function isBotSentMessage(messageId: string): boolean {
  return botSentMessages.has(messageId);
}

/**
 * Remove mensagens expiradas do tracker.
 * Chamada automaticamente pelo intervalo de limpeza.
 */
function cleanupExpiredMessages(): void {
  const now = Date.now();
  let removed = 0;
  const entries = Array.from(botSentMessages.entries());
  for (const [id, timestamp] of entries) {
    if (now - timestamp > MESSAGE_TTL_MS) {
      botSentMessages.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[BotTracker] Limpeza: ${removed} mensagens expiradas removidas (restam: ${botSentMessages.size})`);
  }
}

/**
 * Retorna estatísticas do tracker para diagnóstico.
 */
export function getTrackerStats(): { totalTracked: number; oldestAge: number | null } {
  if (botSentMessages.size === 0) return { totalTracked: 0, oldestAge: null };
  
  const now = Date.now();
  let oldest = now;
  const values = Array.from(botSentMessages.values());
  for (const timestamp of values) {
    if (timestamp < oldest) oldest = timestamp;
  }
  
  return {
    totalTracked: botSentMessages.size,
    oldestAge: Math.round((now - oldest) / 1000), // em segundos
  };
}

// Iniciar limpeza automática
setInterval(cleanupExpiredMessages, CLEANUP_INTERVAL_MS);
