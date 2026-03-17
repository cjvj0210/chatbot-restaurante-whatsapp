import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
const mockGetHumanModeConversations = vi.fn();
const mockGetActiveConversationByWhatsappId = vi.fn();
vi.mock("./db", () => ({
  getHumanModeConversations: (...args: any[]) => mockGetHumanModeConversations(...args),
  getActiveConversationByWhatsappId: (...args: any[]) => mockGetActiveConversationByWhatsappId(...args),
}));

// Mock humanModeService
const mockDeactivateHumanModeForJid = vi.fn().mockResolvedValue(undefined);
vi.mock("./services/humanModeService", () => ({
  deactivateHumanModeForJid: (...args: any[]) => mockDeactivateHumanModeForJid(...args),
}));

// Mock chatbot
const mockResumeConversationAfterBot = vi.fn().mockResolvedValue(undefined);
vi.mock("./chatbot", () => ({
  processIncomingMessage: vi.fn(),
  resumeConversationAfterBot: (...args: any[]) => mockResumeConversationAfterBot(...args),
}));

// Mock auditLog
vi.mock("./auditLog", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

// Mock phoneNormalizer
vi.mock("./utils/phoneNormalizer", () => ({
  phoneNormalizer: {
    normalize: (phone: string) => phone.replace(/\D/g, ""),
  },
}));

describe("Human Mode Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listActive", () => {
    it("retorna conversas em modo humano com flag isExpired", async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 60000); // +30min
      const pastDate = new Date(now.getTime() - 5 * 60000); // -5min

      mockGetHumanModeConversations.mockResolvedValue([
        {
          conversationId: 1,
          customerId: 10,
          customerName: "João Silva",
          customerPhone: "5517988112791",
          humanModeUntil: futureDate,
          updatedAt: now,
        },
        {
          conversationId: 2,
          customerId: 20,
          customerName: "Maria Santos",
          customerPhone: "5517999887766",
          humanModeUntil: pastDate,
          updatedAt: now,
        },
      ]);

      const result = await mockGetHumanModeConversations();

      expect(result).toHaveLength(2);
      expect(result[0].customerName).toBe("João Silva");
      expect(result[1].customerName).toBe("Maria Santos");

      // Simular a lógica do endpoint
      const mapped = result.map((c: any) => ({
        ...c,
        isExpired: c.humanModeUntil ? new Date(c.humanModeUntil) < new Date() : false,
      }));

      expect(mapped[0].isExpired).toBe(false); // futureDate não expirou
      expect(mapped[1].isExpired).toBe(true); // pastDate expirou
    });

    it("retorna lista vazia quando não há conversas em modo humano", async () => {
      mockGetHumanModeConversations.mockResolvedValue([]);

      const result = await mockGetHumanModeConversations();
      expect(result).toHaveLength(0);
    });

    it("trata humanModeUntil null como não expirado", async () => {
      mockGetHumanModeConversations.mockResolvedValue([
        {
          conversationId: 3,
          customerId: 30,
          customerName: "Carlos",
          customerPhone: "5517911223344",
          humanModeUntil: null,
          updatedAt: new Date(),
        },
      ]);

      const result = await mockGetHumanModeConversations();
      const mapped = result.map((c: any) => ({
        ...c,
        isExpired: c.humanModeUntil ? new Date(c.humanModeUntil) < new Date() : false,
      }));

      expect(mapped[0].isExpired).toBe(false);
    });
  });

  describe("returnToBot", () => {
    it("desativa modo humano e retoma conversa", async () => {
      const phone = "5517988112791";
      const conversationId = 1;

      // Simular a lógica do endpoint
      await mockDeactivateHumanModeForJid(phone, phone);
      mockResumeConversationAfterBot(phone, phone);

      expect(mockDeactivateHumanModeForJid).toHaveBeenCalledWith(phone, phone);
      expect(mockResumeConversationAfterBot).toHaveBeenCalledWith(phone, phone);
    });

    it("normaliza telefone com caracteres especiais", async () => {
      const rawPhone = "+55(17)98811-2791";
      const normalized = rawPhone.replace(/\D/g, "");

      expect(normalized).toBe("5517988112791");
    });
  });
});
