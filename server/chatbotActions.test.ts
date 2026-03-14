/**
 * Testes para chatbotActionHandler.ts e humanModeService.ts
 *
 * QM-24: Testes para humanModeService (ativação/desativação/verificação de modo humano)
 * QM-25: Testes para markers LLM (handleOrderLink, handleOrderStatus, handleSaveReservation)
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getCustomerByWhatsappId: vi.fn(),
  getActiveConversation: vi.fn(),
  updateConversation: vi.fn().mockResolvedValue({}),
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(undefined),
}));

const FAKE_JID = "5517999999999@s.whatsapp.net";
const FAKE_CUSTOMER = { id: 1, name: "Cliente Teste", phone: "5517999999999", whatsappId: FAKE_JID };
const FAKE_CONVERSATION = { id: 10, customerId: 1, humanMode: false, humanModeUntil: null, context: "{}", isActive: true };

// ── Tests: humanModeService ───────────────────────────────────────────────────

describe("activateHumanModeForJid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve ignorar silenciosamente quando cliente não encontrado", async () => {
    const { getCustomerByWhatsappId, updateConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(undefined);

    const { activateHumanModeForJid } = await import("./services/humanModeService");
    await expect(activateHumanModeForJid(FAKE_JID)).resolves.not.toThrow();
    expect(updateConversation).not.toHaveBeenCalled();
  });

  it("deve ignorar quando não há conversa ativa", async () => {
    const { getCustomerByWhatsappId, getActiveConversation, updateConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(FAKE_CUSTOMER as any);
    vi.mocked(getActiveConversation).mockResolvedValueOnce(null);

    const { activateHumanModeForJid } = await import("./services/humanModeService");
    await activateHumanModeForJid(FAKE_JID);
    expect(updateConversation).not.toHaveBeenCalled();
  });

  it("deve ativar humanMode com humanModeUntil no futuro", async () => {
    const { getCustomerByWhatsappId, getActiveConversation, updateConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(FAKE_CUSTOMER as any);
    vi.mocked(getActiveConversation).mockResolvedValueOnce(FAKE_CONVERSATION as any);

    const { activateHumanModeForJid } = await import("./services/humanModeService");
    await activateHumanModeForJid(FAKE_JID);

    expect(updateConversation).toHaveBeenCalledWith(
      FAKE_CONVERSATION.id,
      expect.objectContaining({ humanMode: true, humanModeUntil: expect.any(Date) })
    );
    const callArgs = vi.mocked(updateConversation).mock.calls[0]![1] as any;
    expect(callArgs.humanModeUntil.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("deactivateHumanModeForJid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve setar humanMode: false e humanModeUntil: null", async () => {
    const { getCustomerByWhatsappId, getActiveConversation, updateConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(FAKE_CUSTOMER as any);
    vi.mocked(getActiveConversation).mockResolvedValueOnce({ ...FAKE_CONVERSATION, humanMode: true } as any);

    const { deactivateHumanModeForJid } = await import("./services/humanModeService");
    await deactivateHumanModeForJid(FAKE_JID);

    expect(updateConversation).toHaveBeenCalledWith(
      FAKE_CONVERSATION.id,
      { humanMode: false, humanModeUntil: null }
    );
  });
});

describe("isHumanModeActiveForJid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar false se cliente não encontrado", async () => {
    const { getCustomerByWhatsappId } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(undefined);

    const { isHumanModeActiveForJid } = await import("./services/humanModeService");
    const result = await isHumanModeActiveForJid(FAKE_JID);
    expect(result).toBe(false);
  });

  it("deve retornar false se humanMode: false", async () => {
    const { getCustomerByWhatsappId, getActiveConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(FAKE_CUSTOMER as any);
    vi.mocked(getActiveConversation).mockResolvedValueOnce({ ...FAKE_CONVERSATION, humanMode: false } as any);

    const { isHumanModeActiveForJid } = await import("./services/humanModeService");
    const result = await isHumanModeActiveForJid(FAKE_JID);
    expect(result).toBe(false);
  });

  it("deve retornar false se humanModeUntil já passou (modo expirado)", async () => {
    const { getCustomerByWhatsappId, getActiveConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(FAKE_CUSTOMER as any);
    const expiredDate = new Date(Date.now() - 1000); // 1 segundo atrás
    vi.mocked(getActiveConversation).mockResolvedValueOnce({
      ...FAKE_CONVERSATION,
      humanMode: true,
      humanModeUntil: expiredDate,
    } as any);

    const { isHumanModeActiveForJid } = await import("./services/humanModeService");
    const result = await isHumanModeActiveForJid(FAKE_JID);
    expect(result).toBe(false);
  });

  it("deve retornar true se humanMode ativo e humanModeUntil no futuro", async () => {
    const { getCustomerByWhatsappId, getActiveConversation } = await import("./db");
    vi.mocked(getCustomerByWhatsappId).mockResolvedValueOnce(FAKE_CUSTOMER as any);
    const futureDate = new Date(Date.now() + 30 * 60 * 1000); // 30 min no futuro
    vi.mocked(getActiveConversation).mockResolvedValueOnce({
      ...FAKE_CONVERSATION,
      humanMode: true,
      humanModeUntil: futureDate,
    } as any);

    const { isHumanModeActiveForJid } = await import("./services/humanModeService");
    const result = await isHumanModeActiveForJid(FAKE_JID);
    expect(result).toBe(true);
  });
});

// ── Tests: chatbotActionHandler ───────────────────────────────────────────────

describe("handleOrderLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar texto sem alterações quando não há marcador", async () => {
    const { handleOrderLink } = await import("./services/chatbotActionHandler");
    const result = await handleOrderLink("Olá! Como posso ajudar?", "5517999999999");
    expect(result).toBe("Olá! Como posso ajudar?");
  });

  it("deve substituir marcador por '(link temporariamente indisponível)' quando DB não disponível", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb).mockResolvedValueOnce(null);

    const { handleOrderLink } = await import("./services/chatbotActionHandler");
    const result = await handleOrderLink("Acesse [GERAR_LINK_PEDIDO] para pedir", "5517999999999");
    expect(result).toContain("(link temporariamente indisponível)");
  });
});

describe("handleSaveReservation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar texto sem alterações quando não há marcador de reserva", async () => {
    const { handleSaveReservation } = await import("./services/chatbotActionHandler");
    const result = await handleSaveReservation("Sua reserva foi registrada!", "5517999999999");
    expect(result).toBe("Sua reserva foi registrada!");
  });

  it("deve remover o marcador [SALVAR_RESERVA:...] da mensagem enviada ao cliente", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb).mockResolvedValueOnce(null); // DB não disponível

    const { handleSaveReservation } = await import("./services/chatbotActionHandler");
    const input = "Reserva confirmada! [SALVAR_RESERVA:nome=João;data=15/03/2026 19:00;pessoas=4;obs=OBSERVACOES] Até logo!";
    const result = await handleSaveReservation(input, "5517999999999");
    expect(result).not.toContain("[SALVAR_RESERVA:");
    expect(result).toContain("Reserva confirmada!");
  });
});

describe("handleOrderStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deve retornar texto sem alterações quando não há marcador de status", async () => {
    const { handleOrderStatus } = await import("./services/chatbotActionHandler");
    const result = await handleOrderStatus("Seu pedido está a caminho!");
    expect(result).toBe("Seu pedido está a caminho!");
  });

  it("deve substituir por mensagem de indisponibilidade quando DB não disponível", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb).mockResolvedValueOnce(null);

    const { handleOrderStatus } = await import("./services/chatbotActionHandler");
    const result = await handleOrderStatus("Status: [VERIFICAR_STATUS_PEDIDO:PED123456]");
    expect(result).toContain("temporariamente indisponível");
  });

  it("deve substituir por 'pedido não encontrado' quando ordem não existe no banco", async () => {
    const { getDb } = await import("./db");
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // sem resultados
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValueOnce(mockDb as any);

    const { handleOrderStatus } = await import("./services/chatbotActionHandler");
    const result = await handleOrderStatus("Status: [VERIFICAR_STATUS_PEDIDO:PEDNAOEXI]");
    expect(result).toContain("Não encontrei o pedido");
  });
});
