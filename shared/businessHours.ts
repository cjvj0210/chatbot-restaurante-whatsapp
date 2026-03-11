/**
 * Módulo de Horários de Funcionamento - Churrascaria Estrela do Sul
 * 
 * DELIVERY:
 *   Seg-Sex: 11h-14h | 19h-22h
 *   Sáb: 11h-14h15 (só almoço)
 *   Dom: 11h-14h50 | 19h-22h
 * 
 * RETIRADA:
 *   Seg-Sex: 11h-14h15 | 19h-22h15
 *   Sáb: 11h-14h30 | 19h-22h30
 *   Dom: 11h-15h15 | 19h-22h
 * 
 * REGRA ESPECIAL (DELIVERY ALMOÇO):
 *   Cliente pode fazer pedido antes das 11h, mas deve ser avisado que
 *   a produção só começa às 11h e o prazo começa a valer a partir daí.
 */

export type OrderType = "delivery" | "pickup";

interface TimeRange {
  startH: number;
  startM: number;
  endH: number;
  endM: number;
}

interface DaySchedule {
  lunch: TimeRange | null;
  dinner: TimeRange | null;
}

// Horários de DELIVERY por dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
const DELIVERY_HOURS: Record<number, DaySchedule> = {
  0: { // Domingo
    lunch: { startH: 11, startM: 0, endH: 14, endM: 50 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  1: { // Segunda
    lunch: { startH: 11, startM: 0, endH: 14, endM: 0 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  2: { // Terça
    lunch: { startH: 11, startM: 0, endH: 14, endM: 0 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  3: { // Quarta
    lunch: { startH: 11, startM: 0, endH: 14, endM: 0 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  4: { // Quinta
    lunch: { startH: 11, startM: 0, endH: 14, endM: 0 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  5: { // Sexta
    lunch: { startH: 11, startM: 0, endH: 14, endM: 0 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  6: { // Sábado
    lunch: { startH: 11, startM: 0, endH: 14, endM: 15 },
    dinner: null, // FECHADO à noite
  },
};

// Horários de RETIRADA por dia da semana
const PICKUP_HOURS: Record<number, DaySchedule> = {
  0: { // Domingo
    lunch: { startH: 11, startM: 0, endH: 15, endM: 15 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 0 },
  },
  1: { // Segunda
    lunch: { startH: 11, startM: 0, endH: 14, endM: 15 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 15 },
  },
  2: { // Terça
    lunch: { startH: 11, startM: 0, endH: 14, endM: 15 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 15 },
  },
  3: { // Quarta
    lunch: { startH: 11, startM: 0, endH: 14, endM: 15 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 15 },
  },
  4: { // Quinta
    lunch: { startH: 11, startM: 0, endH: 14, endM: 15 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 15 },
  },
  5: { // Sexta
    lunch: { startH: 11, startM: 0, endH: 14, endM: 15 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 15 },
  },
  6: { // Sábado
    lunch: { startH: 11, startM: 0, endH: 14, endM: 30 },
    dinner: { startH: 19, startM: 0, endH: 22, endM: 30 },
  },
};

function toMinutes(h: number, m: number): number {
  return h * 60 + m;
}

function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, "0")}h${m > 0 ? m.toString().padStart(2, "0") : ""}`;
}

export interface BusinessHoursStatus {
  isOpen: boolean;
  /** Se true, o cliente pode fazer pedido mas a produção começa às 11h */
  isEarlyOrder: boolean;
  /** Mensagem de aviso para pedido antecipado */
  earlyOrderMessage?: string;
  /** Próximo horário de abertura (se fechado) */
  nextOpenTime?: string;
  /** Horário de fechamento atual (se aberto) */
  closesAt?: string;
  /** Turno atual: 'lunch' | 'dinner' | null */
  currentShift: "lunch" | "dinner" | null;
}

/**
 * Verifica se o restaurante está aberto para pedidos agora
 * @param orderType "delivery" | "pickup"
 * @param now Opcional: data/hora para teste (padrão: agora)
 */
export function checkBusinessHours(
  orderType: OrderType,
  now?: Date
): BusinessHoursStatus {
  const date = now || new Date();
  const day = date.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
  const currentMinutes = toMinutes(date.getHours(), date.getMinutes());

  const schedule = orderType === "delivery" ? DELIVERY_HOURS[day] : PICKUP_HOURS[day];

  // Verificar turno almoço
  if (schedule.lunch) {
    const lunchStart = toMinutes(schedule.lunch.startH, schedule.lunch.startM);
    const lunchEnd = toMinutes(schedule.lunch.endH, schedule.lunch.endM);

    // Regra especial: pode pedir antes da abertura (qualquer horário antes do almoço)
    if (currentMinutes < lunchStart) {
      return {
        isOpen: true,
        isEarlyOrder: true,
        earlyOrderMessage: `⚠️ Você está fazendo um pedido antecipado! Nossa cozinha abre às ${formatTime(schedule.lunch.startH, schedule.lunch.startM)} — o prazo de entrega começa a contar a partir desse horário.`,
        closesAt: formatTime(schedule.lunch.endH, schedule.lunch.endM),
        currentShift: "lunch",
      };
    }

    if (currentMinutes >= lunchStart && currentMinutes < lunchEnd) {
      return {
        isOpen: true,
        isEarlyOrder: false,
        closesAt: formatTime(schedule.lunch.endH, schedule.lunch.endM),
        currentShift: "lunch",
      };
    }
  }

  // Verificar turno jantar
  if (schedule.dinner) {
    const dinnerStart = toMinutes(schedule.dinner.startH, schedule.dinner.startM);
    const dinnerEnd = toMinutes(schedule.dinner.endH, schedule.dinner.endM);

    if (currentMinutes >= dinnerStart && currentMinutes < dinnerEnd) {
      return {
        isOpen: true,
        isEarlyOrder: false,
        closesAt: formatTime(schedule.dinner.endH, schedule.dinner.endM),
        currentShift: "dinner",
      };
    }
  }

  // Regra especial: entre almoço e jantar — pode agendar para o jantar
  if (schedule.dinner) {
    const dinnerStart = toMinutes(schedule.dinner.startH, schedule.dinner.startM);
    const lunchEnd = schedule.lunch ? toMinutes(schedule.lunch.endH, schedule.lunch.endM) : 0;
    if (currentMinutes >= lunchEnd && currentMinutes < dinnerStart) {
      return {
        isOpen: true,
        isEarlyOrder: true,
        earlyOrderMessage: `⚠️ Você está fazendo um pedido antecipado! Nosso jantar abre às ${formatTime(schedule.dinner.startH, schedule.dinner.startM)} — o prazo começa a contar a partir desse horário.`,
        closesAt: formatTime(schedule.dinner.endH, schedule.dinner.endM),
        currentShift: "dinner",
      };
    }
  }

  // Fechado — calcular próximo horário
  const nextOpen = getNextOpenTime(orderType, date);
  return {
    isOpen: false,
    isEarlyOrder: false,
    nextOpenTime: nextOpen,
    currentShift: null,
  };
}

function getNextOpenTime(orderType: OrderType, now: Date): string {
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const schedule = orderType === "delivery" ? DELIVERY_HOURS : PICKUP_HOURS;
  const currentDay = now.getDay();
  const currentMinutes = toMinutes(now.getHours(), now.getMinutes());

  // Verificar hoje ainda (jantar)
  const todaySchedule = schedule[currentDay];
  if (todaySchedule.dinner) {
    const dinnerStart = toMinutes(todaySchedule.dinner.startH, todaySchedule.dinner.startM);
    if (currentMinutes < dinnerStart) {
      return `hoje às ${formatTime(todaySchedule.dinner.startH, todaySchedule.dinner.startM)}`;
    }
  }

  // Verificar próximos dias
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    const nextSchedule = schedule[nextDay];
    if (nextSchedule.lunch) {
      const dayLabel = i === 1 ? "amanhã" : dayNames[nextDay];
      return `${dayLabel} às ${formatTime(nextSchedule.lunch.startH, nextSchedule.lunch.startM)}`;
    }
  }

  return "em breve";
}

/**
 * Retorna os horários de hoje formatados para exibição
 */
export function getTodayHours(orderType: OrderType, now?: Date): string {
  const date = now || new Date();
  const day = date.getDay();
  const schedule = orderType === "delivery" ? DELIVERY_HOURS[day] : PICKUP_HOURS[day];

  const parts: string[] = [];
  if (schedule.lunch) {
    parts.push(`${formatTime(schedule.lunch.startH, schedule.lunch.startM)} às ${formatTime(schedule.lunch.endH, schedule.lunch.endM)}`);
  }
  if (schedule.dinner) {
    parts.push(`${formatTime(schedule.dinner.startH, schedule.dinner.startM)} às ${formatTime(schedule.dinner.endH, schedule.dinner.endM)}`);
  }

  if (parts.length === 0) return "Fechado hoje";
  return parts.join(" | ");
}
