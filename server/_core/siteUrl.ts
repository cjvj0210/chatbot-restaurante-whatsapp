/**
 * Retorna a URL base do site (frontend) para geração de links externos.
 *
 * IMPORTANTE: variáveis com prefixo VITE_ são injetadas apenas no frontend (Vite build),
 * NÃO chegam ao servidor Node.js em produção. Por isso, a URL de produção é hardcoded
 * diretamente aqui como única fonte de verdade confiável.
 *
 * Para desenvolvimento local, usa SITE_DEV_URL (sem prefixo VITE_) ou localhost.
 */

// URL de produção publicada — hardcoded para garantir consistência
const PRODUCTION_URL = "https://chatbotwa-hesngyeo.manus.space";

export function getSiteUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    return PRODUCTION_URL;
  }

  // Em desenvolvimento, usa a URL do proxy exposto (sem prefixo VITE_)
  const devUrl = process.env.SITE_DEV_URL;
  if (devUrl) {
    return devUrl.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
