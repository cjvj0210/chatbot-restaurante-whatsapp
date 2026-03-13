import { describe, it, expect } from "vitest";
import { getNowBRT, checkBusinessHours } from "../shared/businessHours";
import { formatConfirmationMessage, calcularTempoEstimado } from "./orderNotification";

describe("Timezone BRT - getNowBRT", () => {
  it("deve retornar um Date válido", () => {
    const brt = getNowBRT();
    expect(brt).toBeInstanceOf(Date);
    expect(brt.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("deve ter diferença de ~3 horas em relação a UTC", () => {
    const utc = new Date();
    const brt = getNowBRT();
    // BRT = UTC-3, então brt.getHours() deve ser ~3 horas a menos que utc.getUTCHours()
    // (ou +21 se cruzar meia-noite)
    const utcHour = utc.getUTCHours();
    const brtHour = brt.getHours();
    const diff = ((utcHour - brtHour) + 24) % 24;
    // Deve ser 3 (BRT normal) ou 2 (horário de verão, se aplicável)
    expect(diff).toBeGreaterThanOrEqual(2);
    expect(diff).toBeLessThanOrEqual(3);
  });
});

describe("Previsão de Entrega - Horário de Funcionamento", () => {
  it("pedido confirmado às 06:38 BRT (antes da abertura) deve mostrar previsão a partir das 11h", () => {
    // Simular: sexta-feira 06:38 BRT
    const sexta638 = new Date(2026, 2, 13, 6, 38, 0); // 13/03/2026 sexta
    const status = checkBusinessHours("delivery", sexta638);

    // Às 06:38 é antes do almoço → pedido antecipado
    expect(status.isOpen).toBe(true);
    expect(status.isEarlyOrder).toBe(true);
    expect(status.currentShift).toBe("lunch");
  });

  it("formatConfirmationMessage deve gerar previsão dentro do horário de funcionamento", () => {
    // A função usa getNowBRT() internamente, então vamos validar o resultado
    const msg = formatConfirmationMessage("PED12345", "delivery", "Clóvis Jr");

    // Extrair horário da previsão (formato HH:MM – HH:MM)
    const match = msg.match(/(\d{2}):(\d{2}) – (\d{2}):(\d{2})/);
    expect(match).toBeTruthy();

    if (match) {
      const startHour = parseInt(match[1]);
      const endHour = parseInt(match[3]);

      // A previsão NUNCA deve ser antes das 11h (horário de abertura)
      // nem depois das 23h59 (horário razoável)
      // Se o restaurante está aberto, a previsão é now + tempo
      // Se está fechado, a previsão é a partir da próxima abertura (11h ou 19h)
      const brt = getNowBRT();
      const currentHour = brt.getHours();

      if (currentHour < 11) {
        // Antes da abertura: previsão deve ser >= 11h
        expect(startHour).toBeGreaterThanOrEqual(11);
      } else if (currentHour >= 15 && currentHour < 19) {
        // Entre turnos: previsão deve ser >= 19h
        expect(startHour).toBeGreaterThanOrEqual(19);
      }
      // Em qualquer caso, a previsão não deve ser absurda (antes das 7h)
      // a menos que seja madrugada com pedido para o dia seguinte
      if (currentHour >= 6 && currentHour < 23) {
        expect(startHour).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("calcularTempoEstimado deve retornar tempos corretos", () => {
    const deliveryTempo = calcularTempoEstimado("delivery");
    const pickupTempo = calcularTempoEstimado("pickup");

    // Delivery: 45-70 (semana) ou 60-110 (fim de semana)
    expect(deliveryTempo.min).toBeGreaterThanOrEqual(45);
    expect(deliveryTempo.max).toBeLessThanOrEqual(110);

    // Pickup: sempre 30-50
    expect(pickupTempo.min).toBe(30);
    expect(pickupTempo.max).toBe(50);
  });
});
