import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { handleYCloudWebhookMessage, isYCloudPayload } from "./webhookYCloud";

// Mock processIncomingMessage to avoid actual chatbot processing
vi.mock("./chatbot", () => ({
  processIncomingMessage: vi.fn().mockResolvedValue(undefined),
  resumeConversationAfterBot: vi.fn().mockResolvedValue(undefined),
}));

// Mock markMessageAsReadYCloud
vi.mock("./ycloudApi", () => ({
  markMessageAsReadYCloud: vi.fn().mockResolvedValue(true),
  sendTextMessageYCloud: vi.fn().mockResolvedValue(true),
  sendMediaMessageYCloud: vi.fn().mockResolvedValue(true),
  isYCloudConfigured: vi.fn().mockReturnValue(true),
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
    });

    it("responde 200 para payload válido de mensagem de texto YCloud", async () => {
      const payload = {
        id: "evt_djeIQXaQPQyUcRFi",
        type: "whatsapp.inbound_message.received",
        apiVersion: "v2",
        createTime: "2025-03-17T12:00:00.000Z",
        whatsappInboundMessage: {
          id: "wim123456",
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
        id: "evt_abc123",
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
        id: "evt_abc123",
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
