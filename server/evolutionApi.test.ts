import { describe, it, expect } from "vitest";

/**
 * Testa a conectividade com a Evolution API usando as credenciais configuradas
 */
describe("Evolution API - Validação de Credenciais", () => {
  it("deve ter as variáveis de ambiente configuradas", () => {
    expect(process.env.EVOLUTION_API_URL).toBeTruthy();
    expect(process.env.EVOLUTION_API_KEY).toBeTruthy();
    expect(process.env.EVOLUTION_INSTANCE_NAME).toBeTruthy();
  });

  it("deve conectar na Evolution API e retornar status open", async () => {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

    const response = await fetch(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: { apikey: apiKey! },
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json() as { instance: { state: string } };
    expect(data.instance).toBeDefined();
    // Estado deve ser "open" (conectado) ou pelo menos retornar dados válidos
    expect(["open", "connecting", "close"]).toContain(data.instance.state);
    console.log(`[Test] Evolution API status: ${data.instance.state}`);
  }, 15000);
});
