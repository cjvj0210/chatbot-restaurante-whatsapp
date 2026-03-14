/**
 * Constantes compartilhadas do sistema de chatbot
 * Centraliza magic numbers para facilitar manutenção e configuração
 */

export const CHATBOT = {
  /** Comprimento máximo de mensagem aceita (caracteres) */
  MAX_MESSAGE_LENGTH: 2000,
  /** Janela de rate limiting (milissegundos) */
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,       // 1 hora
  /** Máximo de mensagens por janela */
  RATE_LIMIT_MAX_MESSAGES: 30,
  /** Duração do modo humano (milissegundos) */
  HUMAN_MODE_DURATION_MS: 30 * 60 * 1000,      // 30 minutos
  /** Número de mensagens do histórico para o contexto do LLM */
  HISTORY_MAX_MESSAGES: 30,
  /** TTL de deduplicação de eventos webhook (milissegundos) */
  WEBHOOK_DEDUP_WINDOW_MS: 30_000,
} as const;

export const ORDER = {
  /** Taxa de entrega padrão em centavos (R$ 8,50) — fallback se não configurado no banco */
  DEFAULT_DELIVERY_FEE_CENTS: 850,
  /** Tempo estimado de entrega padrão (minutos) */
  DEFAULT_ESTIMATED_TIME_MINUTES: 40,
} as const;
