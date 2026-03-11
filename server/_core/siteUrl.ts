/**
 * Retorna a URL base do site (frontend) para geração de links externos.
 *
 * Estratégia:
 * - Em produção (NODE_ENV=production): usa o domínio Manus publicado
 * - Em desenvolvimento: usa a URL do proxy de desenvolvimento (VITE_DEV_URL)
 *   ou localhost como fallback
 *
 * A variável VITE_DEV_URL deve ser configurada via webdev_request_secrets
 * com o valor do proxy de desenvolvimento atual.
 */
export function getSiteUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Em produção, usa o domínio publicado no Manus
    // IMPORTANTE: usar o domínio exato publicado (não derivar do VITE_APP_ID pois gera slug incorreto)
    const siteUrl = process.env.VITE_SITE_URL;
    if (siteUrl) {
      return siteUrl.replace(/\/$/, "");
    }
    return "https://chatbotwa-hesngyeo.manus.space";
  }

  // Em desenvolvimento, usa a URL do proxy exposto (configurada como secret)
  // ou a URL do FORGE_API_URL sem o /api como fallback
  const devUrl = process.env.SITE_DEV_URL;
  if (devUrl) {
    return devUrl.replace(/\/$/, "");
  }

  // Fallback: tenta derivar do BUILT_IN_FORGE_API_URL
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  if (forgeUrl && forgeUrl.includes("manusvm.computer")) {
    // Forge URL é algo como https://forge.manus.ai - não serve
    // Usa localhost como último recurso
    return "http://localhost:3000";
  }

  return "http://localhost:3000";
}
