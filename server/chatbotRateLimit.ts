/**
 * Rate limiter por whatsappId para o chatbot
 * Previne abuso: máximo de 30 mensagens por hora por número
 *
 * LIMITAÇÃO CONHECIDA: usa memória local (Map em processo).
 * Em deployments multi-instância (dev + produção simultâneos), cada instância
 * tem seu próprio contador — o limite efetivo pode ser multiplicado pelo número
 * de instâncias. Para correção completa, migrar contador para o banco de dados
 * usando a tabela processed_messages como referência (COUNT por whatsappId + janela).
 * A deduplicação de mensagens já é feita no banco — o rate limit é uma camada adicional.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_MESSAGES = 30;           // máximo por janela

// Map em memória — limpo periodicamente
const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Verifica se o whatsappId pode enviar mais mensagens
 * @returns true se permitido, false se bloqueado
 */
export function checkChatbotRateLimit(whatsappId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(whatsappId);

  if (!entry || (now - entry.windowStart) > WINDOW_MS) {
    // Nova janela
    rateLimits.set(whatsappId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_MESSAGES) {
    return false; // Bloqueado
  }

  entry.count++;
  return true;
}

/**
 * Retorna quantas mensagens restam na janela
 */
export function getRemainingMessages(whatsappId: string): number {
  const now = Date.now();
  const entry = rateLimits.get(whatsappId);

  if (!entry || (now - entry.windowStart) > WINDOW_MS) {
    return MAX_MESSAGES;
  }

  return Math.max(0, MAX_MESSAGES - entry.count);
}

/**
 * Limpa entradas expiradas (chamar periodicamente)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  let cleaned = 0;
  const keys = Array.from(rateLimits.keys());
  for (const key of keys) {
    const entry = rateLimits.get(key);
    if (entry && (now - entry.windowStart) > WINDOW_MS) {
      rateLimits.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[RateLimit] Limpou ${cleaned} entradas expiradas`);
  }
}
