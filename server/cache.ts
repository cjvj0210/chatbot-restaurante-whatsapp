/**
 * Cache em memória simples para queries frequentes do cardápio
 * Reduz carga no banco de dados para endpoints públicos de alto tráfego
 * TTL padrão: 60 segundos (cardápio muda raramente)
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60 * 1000; // 60 segundos

/**
 * Busca do cache ou executa a função e armazena o resultado
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.data as T;
  }

  const data = await fetcher();
  store.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Invalida uma chave específica do cache
 */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/**
 * Invalida todas as chaves que começam com um prefixo
 */
export function invalidateCachePrefix(prefix: string): void {
  const keys = Array.from(store.keys());
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Limpa todo o cache
 */
export function clearCache(): void {
  store.clear();
}

/**
 * Retorna estatísticas do cache
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: store.size,
    keys: Array.from(store.keys()),
  };
}
