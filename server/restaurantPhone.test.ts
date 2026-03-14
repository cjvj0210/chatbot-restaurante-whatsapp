import { describe, it, expect } from "vitest";

describe("RESTAURANT_PHONE", () => {
  it("deve estar configurado como variável de ambiente", () => {
    const phone = process.env.RESTAURANT_PHONE;
    expect(phone).toBeDefined();
    expect(phone!.length).toBeGreaterThan(10);
  });

  it("deve conter apenas dígitos", () => {
    const phone = process.env.RESTAURANT_PHONE!;
    expect(phone).toMatch(/^\d+$/);
  });

  it("deve começar com código do país 55 (Brasil)", () => {
    const phone = process.env.RESTAURANT_PHONE!;
    expect(phone.startsWith("55")).toBe(true);
  });
});
