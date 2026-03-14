/**
 * Testes do fluxo principal de processamento de mensagens WhatsApp
 *
 * Cobre os cenários críticos de processIncomingMessage / _processIncomingMessageInternal:
 *   - Deduplicação: mensagem duplicada deve ser ignorada silenciosamente
 *   - Rate limit atingido: deve enviar aviso e parar
 *   - Modo humano ativo: bot não deve responder
 *   - FAQ cache hit: deve usar cache em vez do LLM
 *   - Resposta [CHAMAR_ATENDENTE]: deve ativar modo humano
 *   - Falha no LLM: deve retornar mensagem de fallback
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Mocks declarados antes de qualquer import que os use ──────────────────────

vi.mock("./db", () => ({
  tryClaimMessage: vi.fn().mockResolvedValue(true),
  getCustomerByWhatsappId: vi.fn().mockResolvedValue({
    id: 1,
    name: "Cliente Teste",
    phone: "5517999999999",
    whatsappId: "5517999999999@s.whatsapp.net",
    address: null,
    deletedAt: null,
  }),
  createCustomer: vi.fn().mockResolvedValue({ id: 2, name: null, phone: "5517999999999", whatsappId: "5517999999999@s.whatsapp.net", address: null }),
  getActiveConversation: vi.fn().mockResolvedValue({
    id: 10,
    customerId: 1,
    humanMode: false,
    humanModeUntil: null,
    context: "{}",
    intent: null,
    isActive: true,
  }),
  createConversation: vi.fn().mockResolvedValue({ id: 10, customerId: 1, humanMode: false, humanModeUntil: null, context: "{}", intent: null }),
  createMessage: vi.fn().mockResolvedValue({}),
  updateConversation: vi.fn().mockResolvedValue({}),
  getConversationMessages: vi.fn().mockResolvedValue([]),
  getRestaurantSettings: vi.fn().mockResolvedValue({ phone: "5517988112791", name: "Churrascaria Estrela do Sul" }),
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Olá! Como posso ajudar? 😊" } }],
  }),
}));

vi.mock("./services/whatsappService", () => ({
  whatsappService: {
    sendText: vi.fn().mockResolvedValue(true),
    sendMedia: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("./chatbotRateLimit", () => ({
  checkChatbotRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("./faqCache", () => ({
  checkFaqCache: vi.fn().mockReturnValue(null),
}));

vi.mock("./services/chatbotActionHandler", () => ({
  handleOrderLink: vi.fn().mockImplementation((r: string) => Promise.resolve(r)),
  handleOrderStatus: vi.fn().mockImplementation((r: string) => Promise.resolve(r)),
  handleSaveReservation: vi.fn().mockImplementation((r: string) => Promise.resolve(r)),
}));

vi.mock("./services/customerContextBuilder", () => ({
  buildCustomerContextBlock: vi.fn().mockResolvedValue(""),
}));

vi.mock("./chatbotPrompt", () => ({
  getChatbotPrompt: vi.fn().mockReturnValue("System prompt de teste"),
}));

vi.mock("./sanitize", () => ({
  sanitizeLLMOutput: vi.fn().mockImplementation((s: string) => s),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(undefined),
}));

// ── Importar módulo após mocks ────────────────────────────────────────────────

const WHATSAPP_ID = "5517999999999@s.whatsapp.net";
const PHONE = "5517999999999";
const MSG_ID = "test-msg-001";
const MSG_TEXT = "Olá, quero ver o cardápio";

describe("processIncomingMessage — deduplicação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve ignorar mensagem duplicada (tryClaimMessage retorna false)", async () => {
    const { tryClaimMessage } = await import("./db");
    const { whatsappService } = await import("./services/whatsappService");
    vi.mocked(tryClaimMessage).mockResolvedValueOnce(false);

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, MSG_TEXT, MSG_ID);

    expect(whatsappService.sendText).not.toHaveBeenCalled();
  });

  it("deve processar mensagem nova (tryClaimMessage retorna true)", async () => {
    const { tryClaimMessage } = await import("./db");
    const { whatsappService } = await import("./services/whatsappService");
    vi.mocked(tryClaimMessage).mockResolvedValueOnce(true);

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, MSG_TEXT, MSG_ID + "-new");

    // Bot deve ter enviado alguma resposta
    expect(whatsappService.sendText).toHaveBeenCalled();
  });
});

describe("processIncomingMessage — rate limiting", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const dbMock = await import("./db");
    vi.mocked(dbMock.tryClaimMessage).mockResolvedValue(true);
  });

  it("deve enviar aviso de rate limit e não chamar LLM quando limite atingido", async () => {
    const { checkChatbotRateLimit } = await import("./chatbotRateLimit");
    const { invokeLLM } = await import("./_core/llm");
    const { whatsappService } = await import("./services/whatsappService");

    vi.mocked(checkChatbotRateLimit).mockResolvedValueOnce(false);

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, MSG_TEXT, MSG_ID + "-rate");

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(whatsappService.sendText).toHaveBeenCalledWith(
      WHATSAPP_ID,
      expect.stringContaining("muitas mensagens")
    );
  });
});

describe("processIncomingMessage — modo humano", () => {
  it("deve silenciar o bot quando modo humano está ativo", async () => {
    vi.clearAllMocks();

    const dbMock = await import("./db");
    const { whatsappService } = await import("./services/whatsappService");
    const { invokeLLM } = await import("./_core/llm");

    vi.mocked(dbMock.tryClaimMessage).mockResolvedValueOnce(true);
    vi.mocked(dbMock.getActiveConversation).mockResolvedValueOnce({
      id: 10,
      customerId: 1,
      humanMode: true,
      humanModeUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min no futuro
      context: "{}",
      intent: null,
      isActive: true,
    } as any);

    // getDb retorna objeto que simula modo humano ainda ativo
    // Primeira chamada: verificação de dbAvailable (retorna truthy simples)
    // Segunda chamada: checkAndExpireHumanMode (retorna mock com update/select)
    const humanModeDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ affectedRows: 0 }]), // não expirou
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ humanMode: true }]),
          }),
        }),
      }),
    };
    vi.mocked(dbMock.getDb).mockResolvedValueOnce({} as any); // dbAvailable check
    vi.mocked(dbMock.getDb).mockResolvedValueOnce(humanModeDb as any); // checkAndExpireHumanMode

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, MSG_TEXT, MSG_ID + "-human");

    expect(invokeLLM).not.toHaveBeenCalled();
    // sendText não deve ser chamado com resposta normal
    const calls = vi.mocked(whatsappService.sendText).mock.calls;
    const hasNormalResponse = calls.some(([, text]) =>
      text.includes("Como posso ajudar")
    );
    expect(hasNormalResponse).toBe(false);
  });
});

describe("processIncomingMessage — FAQ cache", () => {
  it("deve usar cache de FAQ sem chamar LLM quando há match", async () => {
    vi.clearAllMocks();

    const dbMock = await import("./db");
    const { invokeLLM } = await import("./_core/llm");
    const { checkFaqCache } = await import("./faqCache");
    const { whatsappService } = await import("./services/whatsappService");

    vi.mocked(dbMock.tryClaimMessage).mockResolvedValueOnce(true);
    vi.mocked(checkFaqCache).mockReturnValueOnce("Nosso horário é das 11h às 22h! 🕐");

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, "qual o horário?", MSG_ID + "-faq");

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(whatsappService.sendText).toHaveBeenCalledWith(
      WHATSAPP_ID,
      "Nosso horário é das 11h às 22h! 🕐"
    );
  });
});

describe("processIncomingMessage — fallback LLM", () => {
  it("deve retornar mensagem de fallback quando LLM falha", async () => {
    vi.clearAllMocks();

    const dbMock = await import("./db");
    const { invokeLLM } = await import("./_core/llm");
    const { whatsappService } = await import("./services/whatsappService");

    vi.mocked(dbMock.tryClaimMessage).mockResolvedValueOnce(true);
    // Rejeitar todas as tentativas (incluindo retries) para garantir o fallback
    vi.mocked(invokeLLM).mockRejectedValue(new Error("LLM timeout"));

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, MSG_TEXT, MSG_ID + "-llm-fail");

    expect(whatsappService.sendText).toHaveBeenCalledWith(
      WHATSAPP_ID,
      expect.stringContaining("dificuldades técnicas")
    );
  });
});

describe("processIncomingMessage — marcador [CHAMAR_ATENDENTE]", () => {
  it("deve ativar modo humano quando LLM retorna [CHAMAR_ATENDENTE]", async () => {
    vi.clearAllMocks();

    const dbMock = await import("./db");
    const { invokeLLM } = await import("./_core/llm");

    vi.mocked(dbMock.tryClaimMessage).mockResolvedValueOnce(true);
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: "[CHAMAR_ATENDENTE] Um momento, vou chamar um atendente!" } }],
    } as any);

    const { processIncomingMessage } = await import("./chatbot");
    await processIncomingMessage(WHATSAPP_ID, PHONE, "quero falar com atendente", MSG_ID + "-human-req");

    // updateConversation deve ter sido chamado para ativar humanMode
    expect(dbMock.updateConversation).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ humanMode: true })
    );
  });
});
