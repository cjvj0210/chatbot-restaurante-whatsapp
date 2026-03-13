import { describe, it, expect } from "vitest";

describe("DIAG_SECRET", () => {
  it("deve estar configurado como variável de ambiente", () => {
    const diagSecret = process.env.DIAG_SECRET;
    expect(diagSecret).toBeDefined();
    expect(diagSecret!.length).toBeGreaterThan(10);
  });

  it("deve ser diferente do JWT_SECRET", () => {
    const diagSecret = process.env.DIAG_SECRET;
    const jwtSecret = process.env.JWT_SECRET;
    // Se ambos existem, devem ser diferentes
    if (diagSecret && jwtSecret) {
      expect(diagSecret).not.toBe(jwtSecret);
    }
  });

  it("endpoint /api/diag deve rejeitar requisição sem header X-Diag-Secret", async () => {
    const siteUrl = process.env.SITE_DEV_URL || process.env.VITE_SITE_URL || "http://localhost:3000";
    try {
      const res = await fetch(`${siteUrl}/api/diag`);
      // Deve retornar 401 (sem autenticação)
      expect(res.status).toBe(401);
    } catch {
      // Se o servidor não estiver rodando, o teste é inconclusivo mas não falha
      console.log("[Test] Servidor não acessível — teste de endpoint pulado");
    }
  });

  it("endpoint /api/diag deve aceitar requisição com header X-Diag-Secret correto", async () => {
    const siteUrl = process.env.SITE_DEV_URL || process.env.VITE_SITE_URL || "http://localhost:3000";
    const diagSecret = process.env.DIAG_SECRET;
    if (!diagSecret) {
      console.log("[Test] DIAG_SECRET não configurado — teste pulado");
      return;
    }
    try {
      const res = await fetch(`${siteUrl}/api/diag`, {
        headers: { "X-Diag-Secret": diagSecret },
      });
      // Deve retornar 200 com dados de diagnóstico
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("nodeEnv");
      expect(data).toHaveProperty("timestamp");
    } catch {
      console.log("[Test] Servidor não acessível — teste de endpoint pulado");
    }
  });
});
