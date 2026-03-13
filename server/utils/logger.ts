/**
 * Logger centralizado para o servidor
 *
 * Fornece métodos padronizados de log com módulo identificado,
 * facilitando rastreamento e filtragem de logs em produção.
 */

type Module = string;

export const logger = {
  info(mod: Module, msg: string, data?: unknown): void {
    const extra = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${mod}] ${msg}${extra}`);
  },
  warn(mod: Module, msg: string, err?: unknown): void {
    const extra = err !== undefined ? ` ${String(err)}` : "";
    console.warn(`[${mod}] AVISO: ${msg}${extra}`);
  },
  error(mod: Module, msg: string, err: unknown): void {
    console.error(`[${mod}] ERRO: ${msg}`, err);
  },
  debug(mod: Module, msg: string, data?: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      const extra = data !== undefined ? ` ${JSON.stringify(data)}` : "";
      console.log(`[${mod}] DEBUG: ${msg}${extra}`);
    }
  },
};
