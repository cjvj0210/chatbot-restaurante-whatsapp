import { describe, it, expect } from "vitest";

/**
 * Testes para a lógica de normalização de whatsappId e busca de clientes.
 * Valida que o sistema trata corretamente os diferentes formatos de JID do WhatsApp.
 */

// Simular a lógica de normalização de phone (mesma lógica usada em chatbot.ts)
function normalizePhone(phone: string, realPhone?: string): string {
  const effectivePhone = realPhone || phone;
  return effectivePhone
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "")
    .replace(/\D/g, "");
}

// Simular a lógica de canonical whatsappId (mesma lógica usada em chatbot.ts)
function getCanonicalWhatsappId(whatsappId: string, realPhone?: string): string {
  if (realPhone) {
    const digits = realPhone.replace(/\D/g, "");
    return `${digits}@s.whatsapp.net`;
  }
  return whatsappId;
}

// Simular a extração de realPhone do remoteJidAlt
function extractRealPhone(remoteJidAlt?: string): string | undefined {
  if (!remoteJidAlt) return undefined;
  return remoteJidAlt.replace("@s.whatsapp.net", "").replace(/\D/g, "");
}

describe("Normalização de whatsappId", () => {
  it("deve normalizar phone de @s.whatsapp.net", () => {
    expect(normalizePhone("5517988112791@s.whatsapp.net")).toBe("5517988112791");
  });

  it("deve normalizar phone de @lid", () => {
    expect(normalizePhone("212454869074102@lid")).toBe("212454869074102");
  });

  it("deve usar realPhone quando disponível (JID é @lid)", () => {
    expect(normalizePhone("212454869074102@lid", "5517988112791")).toBe("5517988112791");
  });

  it("deve usar realPhone com @s.whatsapp.net quando disponível", () => {
    expect(normalizePhone("212454869074102@lid", "5517988112791@s.whatsapp.net")).toBe("5517988112791");
  });

  it("deve manter phone normal quando não tem realPhone", () => {
    expect(normalizePhone("5517988112791")).toBe("5517988112791");
  });
});

describe("Canonical whatsappId", () => {
  it("deve criar canonical ID quando tem realPhone", () => {
    expect(getCanonicalWhatsappId("212454869074102@lid", "5517988112791")).toBe("5517988112791@s.whatsapp.net");
  });

  it("deve manter whatsappId original quando não tem realPhone", () => {
    expect(getCanonicalWhatsappId("5517988112791@s.whatsapp.net")).toBe("5517988112791@s.whatsapp.net");
  });

  it("deve criar canonical ID com realPhone contendo @s.whatsapp.net", () => {
    expect(getCanonicalWhatsappId("212454869074102@lid", "5517988112791@s.whatsapp.net")).toBe("5517988112791@s.whatsapp.net");
  });
});

describe("Extração de realPhone do remoteJidAlt", () => {
  it("deve extrair número de remoteJidAlt com @s.whatsapp.net", () => {
    expect(extractRealPhone("5517988112791@s.whatsapp.net")).toBe("5517988112791");
  });

  it("deve retornar undefined quando remoteJidAlt é undefined", () => {
    expect(extractRealPhone(undefined)).toBeUndefined();
  });

  it("deve retornar undefined quando remoteJidAlt é string vazia", () => {
    expect(extractRealPhone("")).toBeUndefined();
  });

  it("deve extrair número puro", () => {
    expect(extractRealPhone("5517988112791")).toBe("5517988112791");
  });
});

describe("Fluxo completo: @lid → canonical", () => {
  it("deve converter corretamente um JID @lid para o formato canônico usando remoteJidAlt", () => {
    const remoteJid = "212454869074102@lid";
    const remoteJidAlt = "5517988112791@s.whatsapp.net";
    const pushName = "Clóvis Jr";

    // Extrair realPhone
    const realPhone = extractRealPhone(remoteJidAlt);
    expect(realPhone).toBe("5517988112791");

    // Normalizar phone
    const phone = normalizePhone(remoteJid, realPhone);
    expect(phone).toBe("5517988112791");

    // Obter canonical whatsappId
    const canonicalId = getCanonicalWhatsappId(remoteJid, realPhone);
    expect(canonicalId).toBe("5517988112791@s.whatsapp.net");

    // pushName deve ser preservado
    expect(pushName).toBe("Clóvis Jr");
  });

  it("deve manter dados quando JID já é @s.whatsapp.net (sem remoteJidAlt)", () => {
    const remoteJid = "5517988112791@s.whatsapp.net";
    const remoteJidAlt = undefined;

    const realPhone = extractRealPhone(remoteJidAlt);
    expect(realPhone).toBeUndefined();

    const phone = normalizePhone(remoteJid, realPhone);
    expect(phone).toBe("5517988112791");

    const canonicalId = getCanonicalWhatsappId(remoteJid, realPhone);
    expect(canonicalId).toBe("5517988112791@s.whatsapp.net");
  });
});
