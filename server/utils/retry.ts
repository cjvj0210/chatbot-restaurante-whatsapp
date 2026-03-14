/**
 * Retry com backoff exponencial
 *
 * Utilitário para envolver chamadas a APIs externas (Evolution API, LLM)
 * com retry automático em caso de falha transiente.
 */

import { logger } from "./logger";

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  label?: string;
}

/**
 * Executa uma função assíncrona com retry e backoff exponencial.
 *
 * @param operation - Função a ser executada
 * @param options - Opções de retry
 * @returns Resultado da função em caso de sucesso
 * @throws Último erro caso todas as tentativas falhem
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, label = "Operação" } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const base = delayMs * Math.pow(2, attempt - 1);
      // Jitter de ±50% para evitar thundering herd em retries simultâneos
      const jitter = Math.random() * base;
      const wait = Math.round(base + jitter);
      logger.warn(
        "Retry",
        `${label} falhou (tentativa ${attempt}/${maxRetries}). Aguardando ${wait}ms...`,
        error
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("Max retries exceeded — unreachable");
}
