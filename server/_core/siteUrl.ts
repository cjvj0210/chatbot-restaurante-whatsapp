/**
 * Retorna a URL base do site (frontend) para geração de links externos.
 *
 * URL HARDCODED - não depende de NODE_ENV nem de variáveis de ambiente.
 * SITE_DEV_URL estava sendo injetado em produção e sobrescrevia a URL correta.
 * Domínio publicado correto: chatbotwa-hesngyeo.manus.space
 */
export function getSiteUrl(): string {
  return "https://chatbotwa-hesngyeo.manus.space";
}
