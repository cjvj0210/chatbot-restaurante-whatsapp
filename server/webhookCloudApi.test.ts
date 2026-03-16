import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock dependencies
vi.mock("./chatbot", () => ({
  processIncomingMessage: vi.fn().mockResolvedValue(undefined),
  resumeConversationAfterBot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./services/audioService", () => ({
  processAudioMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./cloudApi", () => ({
  markMessageAsReadCloudApi: vi.fn().mockResolvedValue(true),
  getAudioUrlFromMediaId: vi.fn().mockResolvedValue("https://example.com/audio.ogg"),
}));

vi.mock("./botMessageTracker", () => ({
  isBotSentMessage: vi.fn().mockReturnValue(false),
}));

vi.mock("./utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./utils/phoneNormalizer", () => ({
  phoneNormalizer: {
    toJid: (phone: string) => `${phone}@s.whatsapp.net`,
    withCountryCode: (phone: string) => phone,
  },
}));

import {
  handleCloudApiWebhookVerification,
  handleCloudApiWebhookMessage,
} from "./webhookCloudApi";

describe("Webhook Cloud API", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_WEBHOOK_VERIFY_TOKEN = "estrela-do-sul-webhook-2026";
    process.env.WHATSAPP_PROVIDER = "cloud_api";

    app = express();
    app.use(express.json());
    app.get("/api/webhook/cloud", handleCloudApiWebhookVerification as any);
    app.post("/api/webhook/cloud", handleCloudApiWebhookMessage as any);
  });

  describe("GET /api/webhook/cloud (verificação)", () => {
    it("responde com hub.challenge quando token é válido", async () => {
      const res = await request(app)
        .get("/api/webhook/cloud")
        .query({
          "hub.mode": "subscribe",
          "hub.verify_token": "estrela-do-sul-webhook-2026",
          "hub.challenge": "CHALLENGE_ACCEPTED",
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe("CHALLENGE_ACCEPTED");
    });

    it("rejeita com 403 quando token é inválido", async () => {
      const res = await request(app)
        .get("/api/webhook/cloud")
        .query({
          "hub.mode": "subscribe",
          "hub.verify_token": "token-errado",
          "hub.challenge": "CHALLENGE_ACCEPTED",
        });

      expect(res.status).toBe(403);
    });

    it("rejeita com 403 quando mode não é subscribe", async () => {
      const res = await request(app)
        .get("/api/webhook/cloud")
        .query({
          "hub.mode": "unsubscribe",
          "hub.verify_token": "estrela-do-sul-webhook-2026",
          "hub.challenge": "CHALLENGE_ACCEPTED",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/webhook/cloud (recebimento de mensagens)", () => {
    it("responde 200 para payload válido de mensagem de texto", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "947627211543065",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15551733212",
                    phone_number_id: "107619550223877",
                  },
                  contacts: [
                    {
                      profile: { name: "Clóvis Jr" },
                      wa_id: "5517988112791",
                    },
                  ],
                  messages: [
                    {
                      from: "5517988112791",
                      id: "wamid.HBgNNTUxNzk4ODExMjc5MRUCABIYFjNFQjBFMDY2OTI=",
                      timestamp: "1773675000",
                      text: { body: "Boa tarde" },
                      type: "text",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.text).toBe("EVENT_RECEIVED");
    });

    it("responde 200 para payload de status (não mensagem)", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "947627211543065",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15551733212",
                    phone_number_id: "107619550223877",
                  },
                  statuses: [
                    {
                      id: "wamid.test",
                      status: "delivered",
                      timestamp: "1773675000",
                      recipient_id: "5517988112791",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      expect(res.status).toBe(200);
    });

    it("responde 200 mesmo para objeto não-whatsapp (padrão Meta)", async () => {
      const payload = {
        object: "instagram",
        entry: [],
      };

      const res = await request(app)
        .post("/api/webhook/cloud")
        .send(payload);

      // A Meta espera sempre 200, mesmo para payloads que não processamos
      expect(res.status).toBe(200);
    });
  });
});
