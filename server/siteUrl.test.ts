import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("getSiteUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("retorna a URL de produção correta", async () => {
    const { getSiteUrl } = await import("./_core/siteUrl");
    const url = getSiteUrl();
    expect(url).toBe("https://chatbotwa-hesngyeo.manus.space");
  });

  it("em produção, retorna VITE_SITE_URL quando configurado", async () => {
    process.env.NODE_ENV = "production";
    process.env.VITE_SITE_URL = "https://chatbotwa-hesngyeo.manus.space";
    const { getSiteUrl } = await import("./_core/siteUrl");
    const url = getSiteUrl();
    expect(url).toBe("https://chatbotwa-hesngyeo.manus.space");
  });

  it("em produção sem VITE_SITE_URL, usa fallback correto", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.VITE_SITE_URL;
    const { getSiteUrl } = await import("./_core/siteUrl");
    const url = getSiteUrl();
    expect(url).toBe("https://chatbotwa-hesngyeo.manus.space");
    // Garante que NÃO gera a URL errada com sufixo do VITE_APP_ID
    expect(url).not.toContain("nud5ngjee9cdhq");
  });

  it("em produção, remove barra final da URL", async () => {
    process.env.NODE_ENV = "production";
    process.env.VITE_SITE_URL = "https://chatbotwa-hesngyeo.manus.space/";
    const { getSiteUrl } = await import("./_core/siteUrl");
    const url = getSiteUrl();
    expect(url).toBe("https://chatbotwa-hesngyeo.manus.space");
  });

  it("sempre retorna a URL de produção (URL hardcoded, ignora SITE_DEV_URL)", async () => {
    process.env.NODE_ENV = "development";
    process.env.SITE_DEV_URL = "https://3000-test.manus.computer";
    const { getSiteUrl } = await import("./_core/siteUrl");
    const url = getSiteUrl();
    // A URL é hardcoded para evitar que SITE_DEV_URL sobrescreva em produção
    expect(url).toBe("https://chatbotwa-hesngyeo.manus.space");
  });
});
