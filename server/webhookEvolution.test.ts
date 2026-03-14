/**
 * Tests for webhookEvolution.ts — QM-27
 *
 * Covers:
 *  - apikey validation (security — fail-closed)
 *  - fromMe=true routing: bot message vs operator message
 *  - BOT_COMMANDS handling (#bot → deactivate human mode)
 *  - Non-MESSAGES_UPSERT events ignored
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";

// --- mocks (must be at top level for vi.mock hoisting) ---

vi.mock("./chatbot", () => ({ processIncomingMessage: vi.fn() }));
vi.mock("./evolutionApi", () => ({
  sendTextMessageEvolution: vi.fn(),
  deleteMessageForEveryone: vi.fn(),
}));
vi.mock("./services/whatsappService", () => ({ whatsappService: { sendText: vi.fn(), sendMedia: vi.fn() } }));
vi.mock("./messagePolling", () => ({ markMessageAsProcessed: vi.fn() }));
vi.mock("./botMessageTracker", () => ({ isBotSentMessage: vi.fn() }));
vi.mock("./utils/phoneNormalizer", () => ({
  phoneNormalizer: { normalize: vi.fn((p: string) => p.replace(/\D/g, "")), toJid: vi.fn((p: string) => `${p}@s.whatsapp.net`) },
}));
vi.mock("./services/audioService", () => ({ transcribeFromEvolution: vi.fn() }));
vi.mock("./services/humanModeService", () => ({
  activateHumanModeForJid: vi.fn(),
  deactivateHumanModeForJid: vi.fn(),
  isHumanModeActiveForJid: vi.fn(),
}));
vi.mock("./utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { handleEvolutionWebhook } from "./webhookEvolution";
import { isBotSentMessage } from "./botMessageTracker";
import { processIncomingMessage } from "./chatbot";
import { deactivateHumanModeForJid, activateHumanModeForJid, isHumanModeActiveForJid } from "./services/humanModeService";
import { deleteMessageForEveryone } from "./evolutionApi";

// Typed mocks
const mockIsBotSentMessage = vi.mocked(isBotSentMessage);
const mockProcessIncomingMessage = vi.mocked(processIncomingMessage);
const mockDeactivateHumanMode = vi.mocked(deactivateHumanModeForJid);
const mockActivateHumanMode = vi.mocked(activateHumanModeForJid);
const mockIsHumanModeActive = vi.mocked(isHumanModeActiveForJid);
const mockDeleteMessage = vi.mocked(deleteMessageForEveryone);

/** Helper: creates a minimal mock Express req/res pair */
function mockReqRes(body: object, headers: Record<string, string> = {}) {
  const req = { body, headers } as any;
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn() } as any;
  return { req, res };
}

/** Helper: builds a minimal MESSAGES_UPSERT payload */
function buildPayload(overrides: {
  apikey?: string;
  fromMe?: boolean;
  remoteJid?: string;
  messageId?: string;
  conversation?: string;
  event?: string;
} = {}) {
  return {
    event: overrides.event ?? "MESSAGES_UPSERT",
    instance: "test-instance",
    apikey: overrides.apikey ?? "valid-key",
    data: {
      key: {
        remoteJid: overrides.remoteJid ?? "5517988112791@s.whatsapp.net",
        fromMe: overrides.fromMe ?? false,
        id: overrides.messageId ?? "MSG001",
      },
      pushName: "Test User",
      message: {
        conversation: overrides.conversation ?? "Olá",
      },
      messageType: "conversation",
    },
  };
}

describe("webhookEvolution — apikey validation (QM-27)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVOLUTION_API_KEY = "valid-key";
    mockIsBotSentMessage.mockResolvedValue(false);
    mockProcessIncomingMessage.mockResolvedValue(undefined);
  });

  it("rejects payload when apikey header is missing", async () => {
    const payload = buildPayload({ apikey: undefined });
    delete (payload as any).apikey;
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    // Should still respond 200 (already sent before check)
    expect(res.status).toHaveBeenCalledWith(200);
    // But processIncomingMessage must NOT have been called
    expect(mockProcessIncomingMessage).not.toHaveBeenCalled();
  });

  it("rejects payload when apikey is wrong", async () => {
    const payload = buildPayload({ apikey: "wrong-key" });
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    expect(mockProcessIncomingMessage).not.toHaveBeenCalled();
  });

  it("accepts payload when apikey matches EVOLUTION_API_KEY env var", async () => {
    const payload = buildPayload({ apikey: "valid-key", fromMe: false });
    // Use unique message ID so dedup doesn't block
    (payload.data.key as any).id = `MSG-accept-${Date.now()}`;
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    expect(mockProcessIncomingMessage).toHaveBeenCalled();
  });

  it("accepts apikey from request header (x-api-key fallback)", async () => {
    const payload = buildPayload({ apikey: undefined });
    delete (payload as any).apikey;
    (payload.data.key as any).id = `MSG-header-${Date.now()}`;
    const { req, res } = mockReqRes(payload, { apikey: "valid-key" });

    await handleEvolutionWebhook(req, res);

    expect(mockProcessIncomingMessage).toHaveBeenCalled();
  });
});

describe("webhookEvolution — fromMe=true routing (QM-27)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVOLUTION_API_KEY = "valid-key";
    mockIsBotSentMessage.mockResolvedValue(false);
    mockProcessIncomingMessage.mockResolvedValue(undefined);
    mockIsHumanModeActive.mockResolvedValue(false);
    mockActivateHumanMode.mockResolvedValue(undefined);
    mockDeactivateHumanMode.mockResolvedValue(undefined);
    mockDeleteMessage.mockResolvedValue(true);
  });

  it("ignores message when fromMe=true AND bot sent it (isBotSentMessage=true)", async () => {
    mockIsBotSentMessage.mockResolvedValue(true);
    const payload = buildPayload({ fromMe: true, messageId: `MSG-bot-${Date.now()}` });
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    expect(mockProcessIncomingMessage).not.toHaveBeenCalled();
    expect(mockActivateHumanMode).not.toHaveBeenCalled();
  });

  it("operator sends #bot command → deactivates human mode", async () => {
    mockIsBotSentMessage.mockResolvedValue(false);
    const payload = buildPayload({
      fromMe: true,
      messageId: `MSG-bot-cmd-${Date.now()}`,
      conversation: "#bot",
    });
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    expect(mockDeactivateHumanMode).toHaveBeenCalledWith(payload.data.key.remoteJid);
    expect(mockProcessIncomingMessage).not.toHaveBeenCalled();
  });

  it("operator sends non-command message → activates human mode", async () => {
    mockIsBotSentMessage.mockResolvedValue(false);
    const payload = buildPayload({
      fromMe: true,
      messageId: `MSG-op-manual-${Date.now()}`,
      conversation: "Olá, posso ajudar com o pedido?",
    });
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    expect(mockActivateHumanMode).toHaveBeenCalledWith(payload.data.key.remoteJid);
    expect(mockProcessIncomingMessage).not.toHaveBeenCalled();
  });

  it("ignores non-MESSAGES_UPSERT events (e.g. CONNECTION_UPDATE)", async () => {
    const payload = buildPayload({ event: "connection.update" });
    const { req, res } = mockReqRes(payload);

    await handleEvolutionWebhook(req, res);

    expect(mockProcessIncomingMessage).not.toHaveBeenCalled();
  });
});
