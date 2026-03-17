import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testa a lógica de buildHumanOperatorContext e o fluxo de salvar
 * mensagens do operador humano no histórico.
 *
 * Como buildHumanOperatorContext é uma função interna do chatbot.ts,
 * testamos indiretamente via o webhook YCloud que salva as mensagens
 * e via o generateResponse que injeta o contexto.
 */

// Mock do db
vi.mock("./db", () => ({
  getCustomerByWhatsappId: vi.fn(),
  getActiveConversationByWhatsappId: vi.fn(),
  createMessage: vi.fn(),
  getConversationMessages: vi.fn(),
  getActiveConversation: vi.fn(),
  updateConversation: vi.fn(),
  getRecentOrdersByCustomer: vi.fn().mockResolvedValue([]),
  getActiveReservationsByCustomer: vi.fn().mockResolvedValue([]),
  getDb: vi.fn().mockResolvedValue({}),
  tryClaimMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("./services/humanModeService", () => ({
  activateHumanModeForJid: vi.fn(),
  deactivateHumanModeForJid: vi.fn(),
  isHumanModeActiveForJid: vi.fn().mockResolvedValue(false),
}));

vi.mock("./ycloudApi", () => ({
  markMessageAsReadYCloud: vi.fn(),
  transcribeAudioYCloud: vi.fn(),
  sendTextMessageYCloud: vi.fn().mockResolvedValue(true),
}));

vi.mock("./botMessageTracker", () => ({
  isBotSentMessage: vi.fn().mockResolvedValue(false),
}));

vi.mock("./services/whatsappService", () => ({
  whatsappService: {
    sendText: vi.fn().mockResolvedValue(true),
    sendMedia: vi.fn().mockResolvedValue(true),
    getActiveProvider: vi.fn().mockReturnValue("ycloud"),
  },
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Resposta do bot" } }],
  }),
}));

vi.mock("./services/customerContextBuilder", () => ({
  buildCustomerContextBlock: vi.fn().mockResolvedValue(""),
}));

vi.mock("./chatbotPrompt", () => ({
  getChatbotPrompt: vi.fn().mockReturnValue("System prompt"),
}));

vi.mock("./services/chatbotActionHandler", () => ({
  handleOrderLink: vi.fn().mockImplementation((text) => text),
  handleOrderStatus: vi.fn().mockImplementation((text) => text),
  handleSaveReservation: vi.fn().mockImplementation((text) => text),
}));

vi.mock("./sanitize", () => ({
  sanitizeLLMOutput: vi.fn().mockImplementation((text) => text),
}));

vi.mock("./chatbotRateLimit", () => ({
  checkChatbotRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("./faqCache", () => ({
  checkFaqCache: vi.fn().mockReturnValue(null),
}));

vi.mock("./whatsapp", () => ({
  sendTextMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import {
  getCustomerByWhatsappId,
  getActiveConversationByWhatsappId,
  createMessage,
  getConversationMessages,
  getActiveConversation,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { resumeConversationAfterBot } from "./chatbot";
import { handleYCloudWebhookMessage } from "./webhookYCloud";

describe("Human Operator Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveOperatorMessageToHistory (via webhook)", () => {
    it("salva mensagem do operador no histórico com metadata humanOperator", async () => {
      // Setup
      (getCustomerByWhatsappId as any).mockResolvedValue({ id: 1, whatsappId: "5517988112791" });
      (getActiveConversationByWhatsappId as any).mockResolvedValue({ id: 100 });
      (createMessage as any).mockResolvedValue({ id: 1 });

      const req = {
        headers: {},
        body: {
          type: "whatsapp.smb.message.echoes",
          whatsappMessage: {
            wamid: "wamid.test_operator_001",
            from: "+5517992253886",
            to: "+5517988112791",
            type: "text",
            text: { body: "Olha, consigo fazer 119,90 para os adultos" },
          },
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await handleYCloudWebhookMessage(req, res);

      // Verificar que createMessage foi chamado com metadata humanOperator
      expect(createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 100,
          role: "assistant",
          content: "Olha, consigo fazer 119,90 para os adultos",
          metadata: expect.stringContaining("humanOperator"),
        })
      );

      // Verificar que o metadata contém humanOperator: true
      const callArgs = (createMessage as any).mock.calls.find(
        (call: any[]) => call[0]?.metadata?.includes("humanOperator")
      );
      expect(callArgs).toBeDefined();
      const meta = JSON.parse(callArgs[0].metadata);
      expect(meta.humanOperator).toBe(true);
    });

    it("NÃO salva mensagem #bot no histórico", async () => {
      (getCustomerByWhatsappId as any).mockResolvedValue({ id: 1, whatsappId: "5517988112791" });
      (getActiveConversationByWhatsappId as any).mockResolvedValue({ id: 100 });
      (getActiveConversation as any).mockResolvedValue({ id: 100, context: "{}" });
      (getConversationMessages as any).mockResolvedValue([]);
      (createMessage as any).mockResolvedValue({ id: 1 });

      const req = {
        headers: {},
        body: {
          type: "whatsapp.smb.message.echoes",
          whatsappMessage: {
            wamid: "wamid.test_bot_cmd_001",
            from: "+5517992253886",
            to: "+5517988112791",
            type: "text",
            text: { body: "#bot" },
          },
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await handleYCloudWebhookMessage(req, res);

      // Verificar que createMessage NÃO foi chamado com conteúdo "#bot"
      const botCalls = (createMessage as any).mock.calls.filter(
        (call: any[]) => call[0]?.content === "#bot"
      );
      expect(botCalls.length).toBe(0);
    });

    it("salva echo de imagem com descrição no histórico", async () => {
      (getCustomerByWhatsappId as any).mockResolvedValue({ id: 1, whatsappId: "5517988112791" });
      (getActiveConversationByWhatsappId as any).mockResolvedValue({ id: 100 });
      (createMessage as any).mockResolvedValue({ id: 1 });

      const req = {
        headers: {},
        body: {
          type: "whatsapp.smb.message.echoes",
          whatsappMessage: {
            wamid: "wamid.test_image_001",
            from: "+5517992253886",
            to: "+5517988112791",
            type: "image",
            image: { caption: "Foto do cardápio" },
          },
        },
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as any;

      await handleYCloudWebhookMessage(req, res);

      // Verificar que salvou com descrição da imagem
      const imageCalls = (createMessage as any).mock.calls.filter(
        (call: any[]) => call[0]?.content?.includes("Imagem enviada pelo atendente")
      );
      expect(imageCalls.length).toBe(1);
      expect(imageCalls[0][0].content).toContain("Foto do cardápio");
    });
  });

  describe("buildHumanOperatorContext (via generateResponse)", () => {
    it("injeta contexto do operador humano no system prompt quando há mensagens humanOperator", async () => {
      // Setup: customer e conversa existem
      (getCustomerByWhatsappId as any).mockResolvedValue({ id: 1, whatsappId: "5517988112791" });
      (getActiveConversation as any).mockResolvedValue({
        id: 100,
        context: "{}",
        intent: null,
        humanMode: false,
      });

      // Histórico com mensagens do operador humano
      (getConversationMessages as any).mockResolvedValue([
        // Ordem DESC (mais recente primeiro) — será revertido
        {
          id: 5,
          role: "user",
          content: "Consegue fazer a reserva pra mim?",
          metadata: JSON.stringify({ humanMode: true }),
          createdAt: new Date("2026-03-17T13:22:00"),
        },
        {
          id: 4,
          role: "assistant",
          content: "As crianças já tem valor promocional",
          metadata: JSON.stringify({ humanOperator: true, humanMode: true }),
          createdAt: new Date("2026-03-17T13:22:00"),
        },
        {
          id: 3,
          role: "assistant",
          content: "Olha, consigo fazer 119,90 para os adultos, que é o preço da semana",
          metadata: JSON.stringify({ humanOperator: true, humanMode: true }),
          createdAt: new Date("2026-03-17T13:21:00"),
        },
        {
          id: 2,
          role: "user",
          content: "Consegue desconto",
          metadata: JSON.stringify({ humanMode: true }),
          createdAt: new Date("2026-03-17T13:21:00"),
        },
        {
          id: 1,
          role: "user",
          content: "Queria ir no sábado almoço com uma turma, 8 adultos e 2 crianças de 5",
          metadata: null,
          createdAt: new Date("2026-03-17T13:20:00"),
        },
      ]);

      (createMessage as any).mockResolvedValue({ id: 10 });

      // Chamar resumeConversationAfterBot
      await resumeConversationAfterBot("5517988112791", "5517988112791");

      // Verificar que invokeLLM foi chamado com contexto do operador humano
      expect(invokeLLM).toHaveBeenCalled();
      const llmCall = (invokeLLM as any).mock.calls[0][0];
      const systemMessage = llmCall.messages.find((m: any) => m.role === "system");

      // O system prompt deve conter as instruções sobre atendimento humano
      expect(systemMessage.content).toContain("ATENDIMENTO HUMANO ANTERIOR");
      expect(systemMessage.content).toContain("RESPEITE TUDO que o atendente humano combinou");
      expect(systemMessage.content).toContain("119,90");

      // Verificar que as mensagens do operador estão marcadas no histórico da LLM
      const assistantMessages = llmCall.messages.filter(
        (m: any) => m.role === "assistant" && m.content.includes("[ATENDENTE HUMANO respondeu]")
      );
      expect(assistantMessages.length).toBeGreaterThan(0);
    });

    it("NÃO injeta contexto humano quando não há mensagens humanOperator", async () => {
      (getCustomerByWhatsappId as any).mockResolvedValue({ id: 1, whatsappId: "5517988112791" });
      (getActiveConversation as any).mockResolvedValue({
        id: 100,
        context: "{}",
        intent: null,
        humanMode: false,
      });

      // Histórico normal sem operador humano
      (getConversationMessages as any).mockResolvedValue([
        {
          id: 2,
          role: "user",
          content: "Qual o preço do rodízio?",
          metadata: null,
          createdAt: new Date("2026-03-17T13:20:00"),
        },
        {
          id: 1,
          role: "assistant",
          content: "O rodízio custa R$ 129,90 por pessoa",
          metadata: null,
          createdAt: new Date("2026-03-17T13:19:00"),
        },
      ]);

      (createMessage as any).mockResolvedValue({ id: 10 });

      await resumeConversationAfterBot("5517988112791", "5517988112791");

      // Verificar que NÃO tem contexto de atendimento humano
      if ((invokeLLM as any).mock.calls.length > 0) {
        const llmCall = (invokeLLM as any).mock.calls[0][0];
        const systemMessage = llmCall.messages.find((m: any) => m.role === "system");
        expect(systemMessage.content).not.toContain("ATENDIMENTO HUMANO ANTERIOR");
      }
    });
  });
});
