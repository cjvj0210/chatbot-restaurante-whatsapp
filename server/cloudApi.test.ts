import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies at top level
vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("./botMessageTracker", () => ({
  registerBotSentMessage: vi.fn(),
}));

vi.mock("./utils/retry", () => ({
  withRetry: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

vi.mock("./utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import axios from "axios";
import { registerBotSentMessage } from "./botMessageTracker";
import {
  isCloudApiConfigured,
  sendTextMessageCloudApi,
  sendTextMessageCloudApiWithId,
  sendMediaMessageCloudApi,
  markMessageAsReadCloudApi,
  deleteMessageForEveryoneCloudApi,
} from "./cloudApi";

describe("Cloud API Adapter", () => {
  const mockAxiosPost = vi.mocked(axios.post);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_CLOUD_API_TOKEN = "test-token-123";
    process.env.META_PHONE_NUMBER_ID = "107619550223877";
    process.env.META_WABA_ID = "947627211543065";
    process.env.META_WEBHOOK_VERIFY_TOKEN = "test-verify-token";
  });

  describe("isCloudApiConfigured", () => {
    it("retorna true quando token e phoneNumberId estão configurados", () => {
      expect(isCloudApiConfigured()).toBe(true);
    });

    it("retorna false quando token está ausente", () => {
      process.env.META_CLOUD_API_TOKEN = "";
      expect(isCloudApiConfigured()).toBe(false);
    });

    it("retorna false quando phoneNumberId está ausente", () => {
      process.env.META_PHONE_NUMBER_ID = "";
      expect(isCloudApiConfigured()).toBe(false);
    });
  });

  describe("sendTextMessageCloudApi", () => {
    it("envia mensagem de texto com sucesso", async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: { messages: [{ id: "wamid.test123" }] },
      });

      const result = await sendTextMessageCloudApi("5517988112791", "Olá, teste!");

      expect(result).toBe(true);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining("/107619550223877/messages"),
        expect.objectContaining({
          messaging_product: "whatsapp",
          to: "5517988112791",
          type: "text",
          text: { preview_url: false, body: "Olá, teste!" },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        })
      );
      expect(registerBotSentMessage).toHaveBeenCalledWith("wamid.test123");
    });

    it("normaliza JID @s.whatsapp.net para apenas dígitos", async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: { messages: [{ id: "wamid.test456" }] },
      });

      await sendTextMessageCloudApi("5517988112791@s.whatsapp.net", "Teste JID");

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ to: "5517988112791" }),
        expect.any(Object)
      );
    });

    it("normaliza JID @lid para apenas dígitos", async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: { messages: [{ id: "wamid.test789" }] },
      });

      await sendTextMessageCloudApi("212454869074102@lid", "Teste LID");

      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ to: "212454869074102" }),
        expect.any(Object)
      );
    });

    it("retorna false quando token não está configurado", async () => {
      process.env.META_CLOUD_API_TOKEN = "";
      const result = await sendTextMessageCloudApi("5517988112791", "Teste");
      expect(result).toBe(false);
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it("retorna false quando API retorna erro", async () => {
      mockAxiosPost.mockRejectedValueOnce({
        response: { data: { error: { message: "Invalid token" } } },
        message: "Request failed",
      });

      const result = await sendTextMessageCloudApi("5517988112791", "Teste");
      expect(result).toBe(false);
    });
  });

  describe("sendTextMessageCloudApiWithId", () => {
    it("retorna o ID da mensagem enviada", async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: { messages: [{ id: "wamid.return123" }] },
      });

      const id = await sendTextMessageCloudApiWithId("5517988112791", "Teste com ID");

      expect(id).toBe("wamid.return123");
      expect(registerBotSentMessage).toHaveBeenCalledWith("wamid.return123");
    });

    it("retorna null quando falha", async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error("Network error"));

      const id = await sendTextMessageCloudApiWithId("5517988112791", "Teste");
      expect(id).toBeNull();
    });

    it("retorna null quando token não configurado", async () => {
      process.env.META_CLOUD_API_TOKEN = "";
      const id = await sendTextMessageCloudApiWithId("5517988112791", "Teste");
      expect(id).toBeNull();
    });
  });

  describe("sendMediaMessageCloudApi", () => {
    it("envia imagem com legenda", async () => {
      mockAxiosPost.mockResolvedValueOnce({
        data: { messages: [{ id: "wamid.media123" }] },
      });

      const result = await sendMediaMessageCloudApi(
        "5517988112791",
        "https://example.com/image.jpg",
        "Legenda da imagem"
      );

      expect(result).toBe(true);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messaging_product: "whatsapp",
          type: "image",
          image: {
            link: "https://example.com/image.jpg",
            caption: "Legenda da imagem",
          },
        }),
        expect.any(Object)
      );
    });

    it("retorna false quando falha", async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error("Upload failed"));

      const result = await sendMediaMessageCloudApi(
        "5517988112791",
        "https://example.com/image.jpg",
        "Teste"
      );
      expect(result).toBe(false);
    });
  });

  describe("markMessageAsReadCloudApi", () => {
    it("marca mensagem como lida", async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { success: true } });

      const result = await markMessageAsReadCloudApi("wamid.test123");

      expect(result).toBe(true);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messaging_product: "whatsapp",
          status: "read",
          message_id: "wamid.test123",
        }),
        expect.any(Object)
      );
    });

    it("retorna false quando falha", async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error("Failed"));
      const result = await markMessageAsReadCloudApi("wamid.test123");
      expect(result).toBe(false);
    });
  });

  describe("deleteMessageForEveryoneCloudApi", () => {
    it("retorna false (não suportado na Cloud API)", async () => {
      const result = await deleteMessageForEveryoneCloudApi("5517988112791", "msg123");
      expect(result).toBe(false);
    });

    it("não faz chamadas HTTP", async () => {
      await deleteMessageForEveryoneCloudApi("5517988112791", "msg123");
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });
  });
});
