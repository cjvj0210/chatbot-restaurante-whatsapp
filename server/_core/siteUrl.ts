/**
 * Retorna a URL base do site (frontend) baseada no APP_ID.
 * Em desenvolvimento, usa localhost:3000.
 * Em produção, usa o domínio Manus gerado a partir do APP_ID.
 */
export function getSiteUrl(): string {
  const appId = process.env.VITE_APP_ID ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return "http://localhost:3000";
  }

  if (appId) {
    // Formato do domínio Manus: chatbotwa-{appIdLowerSlug}.manus.space
    // O APP_ID é algo como "hEsNGYEonud5ngJEe9CdHq"
    // O domínio é gerado como prefixo lowercase sem caracteres especiais
    const slug = appId.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `https://chatbotwa-${slug}.manus.space`;
  }

  return "http://localhost:3000";
}
