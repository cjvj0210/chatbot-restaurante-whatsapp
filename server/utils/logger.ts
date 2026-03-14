/**
 * Logger centralizado para o servidor
 *
 * Fornece métodos padronizados de log com módulo identificado e timestamp ISO,
 * facilitando rastreamento e filtragem de logs em produção.
 */

type Module = string;

function serializeExtra(data: unknown): string {
  if (data === undefined) return "";
  if (data instanceof Error) {
    return ` ${data.message}${data.stack ? `\n${data.stack}` : ""}`;
  }
  try {
    return ` ${JSON.stringify(data)}`;
  } catch {
    return ` ${String(data)}`;
  }
}

export const logger = {
  info(mod: Module, msg: string, data?: unknown): void {
    const ts = new Date().toISOString();
    console.log(`${ts} [${mod}] ${msg}${serializeExtra(data)}`);
  },
  warn(mod: Module, msg: string, err?: unknown): void {
    const ts = new Date().toISOString();
    console.warn(`${ts} [${mod}] AVISO: ${msg}${serializeExtra(err)}`);
  },
  error(mod: Module, msg: string, err: unknown): void {
    const ts = new Date().toISOString();
    console.error(`${ts} [${mod}] ERRO: ${msg}${serializeExtra(err)}`);
  },
  debug(mod: Module, msg: string, data?: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      const ts = new Date().toISOString();
      console.log(`${ts} [${mod}] DEBUG: ${msg}${serializeExtra(data)}`);
    }
  },
};
