import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { handleYCloudWebhookMessage, isYCloudPayload } from "./webhookYCloud";

// Mock processIncomingMessage and resumeConversationAfterBot
const mockProcessIncomingMessage = vi.fn().mockResolvedValue(undefined);
const mockResumeConversationAfterBot = vi.fn().mockResolvedValue(undefined);
vi.mock("./chatbot", () => ({
  processIncomingMessage: (...args: any[]) => mockProcessIncomingMessage(...args),
  resumeConversationAfterBot: (...args: any[]) => mockResumeConversationAfterBot(...args),
  setHumanModeCache: vi.fn(),
  clearHumanModeCache: vi.fn(),
}));

// Mock ycloudApi
vi.mock("./ycloudApi", () => ({
  markMessageAsReadYCloud: vi.fn().mockResolvedValue(true),
  transcribeAudioYCloud: vi.fn().mockResolvedValue("transcrição de teste"),
  sendTextMessageYCloud: vi.fn().mockResolvedValue(true),
  sendMediaMessageYCloud: vi.fn().mockResolvedValue(true),
  isYCloudConfigured: vi.fn().mockReturnValue(true),
}));

// Mock botMessageTracker
const mockIsBotSentMessage = vi.fn().mockResolvedValue(false);
vi.mock("./botMessageTracker", () => ({
  isBotSentMessage: (...args: any[]) => mockIsBotSentMessage(...args),
  registerBotSentMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock humanModeService
const mockActivateHumanMode = vi.fn().mockResolvedValue(undefined);
const mockDeactivateHumanMode = vi.fn().mockResolvedValue(undefined);
vi.mock("./services/humanModeService", () => ({
  activateHumanModeForJid: (...args: any[]) => mockActivateHumanMode(...args),
  deactivateHumanModeForJid: (...args: any[]) => mockDeactivateHumanMode(...args),
  isHumanModeActiveForJid: vi.fn().mockResolvedValue(false),
}));

describe("YCloud Integration", () => {
  describe("isYCloudPayload", () => {
    it("detecta payload YCloud corretamente", () => {
      expect(isYCloudPayload({
        id: "evt_test",
        type: "whatsapp.inbound_message.received",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
      })).toBe(true);
    });

    it("detecta payload YCloud de echo corretamente", () => {
      expect(isYCloudPayload({
        id: "evt_test",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
      })).toBe(true);
    });

    it("rejeita payload Meta Cloud API", () => {
      expect(isYCloudPayload({
        object: "whatsapp_business_account",
        entry: [],
      })).toBe(false);
    });

    it("rejeita payload vazio", () => {
      expect(isYCloudPayload(null)).toBe(false);
      expect(isYCloudPayload(undefined)).toBe(false);
      expect(isYCloudPayload({})).toBe(false);
    });
  });

  describe("POST /api/webhook/cloud (YCloud format)", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post("/api/webhook/cloud", handleYCloudWebhookMessage as any);
      vi.clearAllMocks();
    });

    it("responde 200 para payload válido de mensagem de texto YCloud", async () => {
      const payload = {
        id: "evt_text_msg_001",
        type: "whatsapp.inbound_message.received",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappInboundMessage: {
          id: "wim_text_001",
          wabaId: "2430571627387237",
          from: "+5517988112791",
          customerProfile: {
            name: "Cliente Teste",
          },
          to: "+5517992253886",
          sendTime: "2025-03-17T12:00:00.000Z",
          type: "text",
          text: {
            body: "Olá, quero fazer um pedido!",
          },
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.text).toBe("EVENT_RECEIVED");
    });

    it("responde 200 para evento não-mensagem (status update)", async () => {
      const payload = {
        id: "evt_status_001",
        type: "whatsapp.message.updated",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappMessage: {
          id: "msg123",
          status: "delivered",
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
    });

    it("responde 200 para payload sem whatsappInboundMessage", async () => {
      const payload = {
        id: "evt_no_msg_001",
        type: "whatsapp.inbound_message.received",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        // whatsappInboundMessage ausente
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
    });
  });

  describe("whatsapp.smb.message.echoes — Detecção de #bot", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post("/api/webhook/cloud", handleYCloudWebhookMessage as any);
      vi.clearAllMocks();
      mockIsBotSentMessage.mockResolvedValue(false);
    });

    it("detecta comando #bot do operador e desativa modo humano", async () => {
      const payload = {
        id: "evt_echo_bot_001",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappMessage: {
          id: "63f5d602367ea403f8175a6c",
          wamid: "wamid.echo_bot_001",
          status: "sent",
          from: "+5517992253886", // Restaurante
          to: "+5517988112791", // Cliente
          wabaId: "2430571627387237",
          createTime: "2025-03-17T12:00:00.000Z",
          sendTime: "2025-03-17T12:00:01.000Z",
          bizType: "whatsapp",
          type: "text",
          text: {
            body: "#bot",
          },
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);

      // Aguardar processamento assíncrono (handleSmbMessageEcho é fire-and-forget)
      await new Promise((r) => setTimeout(r, 200));

      // Deve desativar modo humano
      expect(mockDeactivateHumanMode).toHaveBeenCalledTimes(1);
      // O primeiro argumento deve ser o número do cliente normalizado
      const callArgs = mockDeactivateHumanMode.mock.calls[0];
      expect(callArgs[0]).toMatch(/5517988112791/);

      // Deve enviar confirmação ao cliente via sendTextMessageYCloud
      const { sendTextMessageYCloud: mockSendText } = await import("./ycloudApi");
      expect(mockSendText).toHaveBeenCalled();

      // Aguardar o setTimeout de 2s para o resumeConversationAfterBot
      await new Promise((r) => setTimeout(r, 2500));

      // Deve retomar conversa após o delay
      expect(mockResumeConversationAfterBot).toHaveBeenCalledTimes(1);

      // NÃO deve ativar modo humano
      expect(mockActivateHumanMode).not.toHaveBeenCalled();
    }, 10000);

    it("detecta comando #ativar do operador e desativa modo humano", async () => {
      const payload = {
        id: "evt_echo_ativar_001",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappMessage: {
          id: "63f5d602367ea403f8175a6d",
          wamid: "wamid.echo_ativar_001",
          status: "sent",
          from: "+5517992253886",
          to: "+5517988112791",
          wabaId: "2430571627387237",
          createTime: "2025-03-17T12:00:00.000Z",
          sendTime: "2025-03-17T12:00:01.000Z",
          bizType: "whatsapp",
          type: "text",
          text: {
            body: "#ativar",
          },
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 200));

      expect(mockDeactivateHumanMode).toHaveBeenCalledTimes(1);

      // Aguardar o setTimeout de 2s para o resumeConversationAfterBot
      await new Promise((r) => setTimeout(r, 2500));

      expect(mockResumeConversationAfterBot).toHaveBeenCalledTimes(1);
    }, 10000);

    it("ativa modo humano quando operador envia mensagem normal (não #bot)", async () => {
      const payload = {
        id: "evt_echo_normal_001",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappMessage: {
          id: "63f5d602367ea403f8175a6e",
          wamid: "wamid.echo_normal_001",
          status: "sent",
          from: "+5517992253886",
          to: "+5517988112791",
          wabaId: "2430571627387237",
          createTime: "2025-03-17T12:00:00.000Z",
          sendTime: "2025-03-17T12:00:01.000Z",
          bizType: "whatsapp",
          type: "text",
          text: {
            body: "Olá, vou verificar seu pedido!",
          },
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 100));

      // Deve ativar modo humano (operador respondeu manualmente)
      expect(mockActivateHumanMode).toHaveBeenCalledTimes(1);
      const callArgs = mockActivateHumanMode.mock.calls[0];
      expect(callArgs[0]).toMatch(/5517988112791/);

      // NÃO deve desativar modo humano
      expect(mockDeactivateHumanMode).not.toHaveBeenCalled();
      // NÃO deve retomar bot
      expect(mockResumeConversationAfterBot).not.toHaveBeenCalled();
    });

    it("ignora echo de mensagem enviada pelo bot via API", async () => {
      // Simular que a mensagem foi enviada pelo bot
      mockIsBotSentMessage.mockResolvedValue(true);

      const payload = {
        id: "evt_echo_botmsg_001",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappMessage: {
          id: "63f5d602367ea403f8175a6f",
          wamid: "wamid.echo_botmsg_001",
          status: "sent",
          from: "+5517992253886",
          to: "+5517988112791",
          wabaId: "2430571627387237",
          createTime: "2025-03-17T12:00:00.000Z",
          sendTime: "2025-03-17T12:00:01.000Z",
          bizType: "whatsapp",
          type: "text",
          text: {
            body: "Resposta automática do bot",
          },
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 100));

      // NÃO deve ativar nem desativar modo humano (mensagem do bot)
      expect(mockActivateHumanMode).not.toHaveBeenCalled();
      expect(mockDeactivateHumanMode).not.toHaveBeenCalled();
    });

    it("ignora echo sem whatsappMessage", async () => {
      const payload = {
        id: "evt_echo_empty_001",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        // whatsappMessage ausente
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 100));

      expect(mockActivateHumanMode).not.toHaveBeenCalled();
      expect(mockDeactivateHumanMode).not.toHaveBeenCalled();
    });

    it("ativa modo humano para echo de imagem (não texto)", async () => {
      const payload = {
        id: "evt_echo_image_001",
        type: "whatsapp.smb.message.echoes",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappMessage: {
          id: "63f5d602367ea403f8175a70",
          wamid: "wamid.echo_image_001",
          status: "sent",
          from: "+5517992253886",
          to: "+5517988112791",
          wabaId: "2430571627387237",
          createTime: "2025-03-17T12:00:00.000Z",
          sendTime: "2025-03-17T12:00:01.000Z",
          bizType: "whatsapp",
          type: "image",
          image: {
            link: "https://api.ycloud.com/v2/whatsapp/media/download/123",
            id: "123",
            sha256: "abc",
            mime_type: "image/jpeg",
          },
        },
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 100));

      // Operador enviou imagem → ativar modo humano
      expect(mockActivateHumanMode).toHaveBeenCalledTimes(1);
    });
  });

  describe("Configuração de secrets", () => {
    it("YCLOUD_API_KEY deve estar configurada", () => {
      const apiKey = process.env.YCLOUD_API_KEY;
      expect(apiKey).toBeDefined();
      expect(apiKey!.length).toBeGreaterThan(10);
    });

    it("YCLOUD_WEBHOOK_SECRET deve estar configurada", () => {
      const secret = process.env.YCLOUD_WEBHOOK_SECRET;
      expect(secret).toBeDefined();
      expect(secret!.startsWith("whsec_")).toBe(true);
    });

    it("YCLOUD_WEBHOOK_ID deve estar configurada", () => {
      const webhookId = process.env.YCLOUD_WEBHOOK_ID;
      expect(webhookId).toBeDefined();
      expect(webhookId!.length).toBeGreaterThan(10);
    });

    it("WHATSAPP_PROVIDER deve ser ycloud", () => {
      const provider = process.env.WHATSAPP_PROVIDER;
      expect(provider).toBe("ycloud");
    });
  });
});
