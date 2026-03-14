import { describe, it, expect, vi } from "vitest";

// ===== Testes de performance para as correções implementadas =====

describe("Performance Fixes", () => {
  // Teste 1: Cache BRT DateTime
  describe("getBRTDateTimeFormatted cache", () => {
    it("deve retornar diaSemana, dataCompleta e horarioAtual", async () => {
      const { getBRTDateTimeFormatted } = await import("../shared/businessHours");
      const result = getBRTDateTimeFormatted();
      expect(result).toHaveProperty("diaSemana");
      expect(result).toHaveProperty("dataCompleta");
      expect(result).toHaveProperty("horarioAtual");
      expect(typeof result.diaSemana).toBe("string");
      expect(typeof result.dataCompleta).toBe("string");
      expect(typeof result.horarioAtual).toBe("string");
    });

    it("deve retornar o mesmo resultado dentro de 500ms (cache hit)", async () => {
      const { getBRTDateTimeFormatted } = await import("../shared/businessHours");
      const result1 = getBRTDateTimeFormatted();
      const result2 = getBRTDateTimeFormatted();
      // Dentro de 500ms, deve ser exatamente o mesmo objeto (referência)
      expect(result1).toBe(result2);
    });
  });

  // Teste 2: FAQ quickKeywords pré-filtro
  describe("FAQ quickKeywords pré-filtro", () => {
    it("deve retornar resposta para saudação simples", async () => {
      const { checkFaqCache } = await import("./faqCache");
      const result = checkFaqCache("Oi");
      expect(result).toBeTruthy();
      expect(result).toContain("Gauchinho");
    });

    it("deve retornar null para mensagem sem keywords", async () => {
      const { checkFaqCache } = await import("./faqCache");
      const result = checkFaqCache("quero fazer um pedido de churrasco misto com farofa");
      expect(result).toBeNull();
    });

    it("deve retornar resposta para endereço", async () => {
      const { checkFaqCache } = await import("./faqCache");
      const result = checkFaqCache("Onde fica o restaurante?");
      expect(result).toBeTruthy();
      expect(result).toContain("Barretos");
    });

    it("deve retornar resposta para pagamento", async () => {
      const { checkFaqCache } = await import("./faqCache");
      const result = checkFaqCache("Aceita cartão?");
      expect(result).toBeTruthy();
      expect(result).toContain("PIX");
    });
  });

  // Teste 3: Cache de settings
  describe("Cache de restaurant settings", () => {
    it("cached deve retornar dados do fetcher e cachear", async () => {
      const { cached, invalidateCache } = await import("./cache");
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { name: "Estrela do Sul" };
      };

      const result1 = await cached("test_settings", fetcher, 5000);
      const result2 = await cached("test_settings", fetcher, 5000);

      expect(result1).toEqual({ name: "Estrela do Sul" });
      expect(result2).toEqual({ name: "Estrela do Sul" });
      expect(callCount).toBe(1); // Só chamou o fetcher uma vez

      invalidateCache("test_settings");
      const result3 = await cached("test_settings", fetcher, 5000);
      expect(callCount).toBe(2); // Chamou de novo após invalidar
      invalidateCache("test_settings"); // Limpar
    });
  });

  // Teste 4: Retry com jitter
  describe("Retry com jitter", () => {
    it("deve executar com sucesso na primeira tentativa", async () => {
      const { withRetry } = await import("./utils/retry");
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await withRetry(fn, { maxRetries: 3, delayMs: 10 });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("deve fazer retry e ter sucesso na segunda tentativa", async () => {
      const { withRetry } = await import("./utils/retry");
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("ok");
      const result = await withRetry(fn, { maxRetries: 3, delayMs: 10, label: "test" });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("deve lançar erro após esgotar tentativas", async () => {
      const { withRetry } = await import("./utils/retry");
      const fn = vi.fn().mockRejectedValue(new Error("always fail"));
      await expect(
        withRetry(fn, { maxRetries: 2, delayMs: 10, label: "test" })
      ).rejects.toThrow("always fail");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // Teste 5: Polling stats
  describe("Polling stats", () => {
    it("deve retornar estatísticas válidas", async () => {
      const { getPollingStats } = await import("./messagePolling");
      const stats = getPollingStats();
      expect(stats).toHaveProperty("processedCount");
      expect(stats).toHaveProperty("lastPollTimestamp");
      expect(stats).toHaveProperty("pollErrors");
      expect(stats).toHaveProperty("isPolling");
      expect(typeof stats.processedCount).toBe("number");
    });
  });

  // Teste 6: markMessageAsProcessed
  describe("markMessageAsProcessed", () => {
    it("deve marcar mensagem como processada", async () => {
      const { markMessageAsProcessed, getPollingStats } = await import("./messagePolling");
      const before = getPollingStats().processedCount;
      markMessageAsProcessed("test-msg-" + Date.now());
      const after = getPollingStats().processedCount;
      expect(after).toBe(before + 1);
    });
  });
});
