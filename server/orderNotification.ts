import { getDb } from "./db";
import { botMessages, orders, orderItems, menuItems, orderSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendTextMessage } from "./whatsapp";
import { sendTextMessageEvolution } from "./evolutionApi";
import { checkBusinessHours, getNowBRT } from "../shared/businessHours";
import { phoneNormalizer } from "./utils/phoneNormalizer";
import { logger } from "./utils/logger";

/**
 * Envia mensagem de texto via Evolution API (principal) com fallback para WhatsApp Cloud API
 */
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const normalizedPhone = phoneNormalizer.withCountryCode(phone);
  // Tentar primeiro via Evolution API (número de teste configurado)
  const sentEvolution = await sendTextMessageEvolution(normalizedPhone, message);
  if (sentEvolution) return true;
  // Fallback para WhatsApp Cloud API
  return await sendTextMessage(phone, message);
}

/**
 * Formata valor em centavos para Real brasileiro
 */
function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Calcula o tempo estimado dinâmico baseado no tipo de pedido e dia da semana
 * Delivery:
 *   Seg-Sex: 45-70 min
 *   Sáb-Dom: 60-110 min
 * Retirada: sempre 30-50 min
 */
export function calcularTempoEstimado(orderType: string): { min: number; max: number } {
  const now = getNowBRT();
  const dayOfWeek = now.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb (horário BRT)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (orderType === "delivery") {
    return isWeekend ? { min: 60, max: 110 } : { min: 45, max: 70 };
  } else {
    return { min: 30, max: 50 };
  }
}

/**
 * Formata pedido para mensagem WhatsApp (enviada ao cliente quando pedido é recebido)
 */
export async function formatOrderForWhatsApp(orderId: number): Promise<string> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  // Buscar pedido
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new Error("Pedido não encontrado");
  }

  // Buscar itens do pedido com detalhes do menu
  const items = await db
    .select({
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      name: menuItems.name,
      observations: orderItems.observations,
    })
    .from(orderItems)
    .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
    .where(eq(orderItems.orderId, orderId));

  // Montar mensagem de recebimento (aguardando aceite)
  let message = `⏳ *Pedido #${order.orderNumber} Recebido!*\n\n`;
  message += `Olá, *${order.customerName}*! 😊\n`;
  message += `Recebemos seu pedido e estamos aguardando a confirmação do restaurante.\n\n`;

  message += `📦 *Itens:*\n`;
  for (const item of items) {
    const itemTotal = item.quantity * item.unitPrice;
    message += `• ${item.quantity}x ${item.name} — ${formatCurrency(itemTotal)}\n`;
    if (item.observations) {
      message += `  _Obs: ${item.observations}_\n`;
    }
  }

  message += `\n💰 *Subtotal:* ${formatCurrency(order.subtotal)}\n`;

  if (order.orderType === "delivery") {
    message += `🚚 *Taxa de entrega:* ${formatCurrency(order.deliveryFee)}\n`;
  }

  message += `💵 *Total:* ${formatCurrency(order.total)}\n\n`;

  if (order.orderType === "delivery") {
    message += `📍 *Entrega em:*\n${order.deliveryAddress}\n\n`;
  } else {
    message += `🏪 *Retirada no local*\n\n`;
  }

  message += `💳 *Pagamento:* ${order.paymentMethod}\n\n`;

  if (order.customerNotes) {
    message += `📝 *Obs:* ${order.customerNotes}\n\n`;
  }

  message += `_Você receberá uma mensagem assim que o restaurante confirmar seu pedido!_ ✅`;

  return message;
}

/**
 * Calcula o instante base (em BRT) a partir do qual contar a previsão de entrega/retirada.
 *
 * Três cenários possíveis:
 *  - Restaurante aberto agora → baseTime = agora
 *  - Pedido antecipado (antes da abertura) → baseTime = horário de abertura do turno
 *  - Restaurante fechado → baseTime = próximo horário de abertura (19h ou amanhã 11h)
 *
 * @param orderType - "delivery" | "pickup"
 * @param now - data/hora atual em BRT (getNowBRT())
 * @returns `{ baseTime, isOutsideHours }` onde `isOutsideHours` indica previsão fora do horário
 */
export function calcularBaseTime(
  orderType: string,
  now: Date
): { baseTime: Date; isOutsideHours: boolean } {
  const businessStatus = checkBusinessHours(orderType === 'delivery' ? 'delivery' : 'pickup', now);

  if (!businessStatus.isOpen && !businessStatus.isEarlyOrder) {
    // Restaurante fechado — usar próximo horário de abertura
    const currentHour = now.getHours();
    const baseTime = new Date(now);
    if (currentHour >= 22 || currentHour < 11) {
      // Após jantar ou antes do almoço — usar amanhã 11h
      if (currentHour >= 22) baseTime.setDate(baseTime.getDate() + 1);
      baseTime.setHours(11, 0, 0, 0);
    } else {
      // Entre almoço e jantar — usar 19h
      baseTime.setHours(19, 0, 0, 0);
    }
    return { baseTime, isOutsideHours: true };
  }

  if (businessStatus.isEarlyOrder && businessStatus.currentShift) {
    // Pedido antecipado — usar horário de abertura do turno
    const baseTime = new Date(now);
    if (businessStatus.currentShift === 'lunch') {
      baseTime.setHours(11, 0, 0, 0);
    } else {
      baseTime.setHours(19, 0, 0, 0);
    }
    return { baseTime, isOutsideHours: false };
  }

  return { baseTime: now, isOutsideHours: false };
}

/**
 * Formata mensagem de confirmação do pedido (enviada ao cliente quando operador aceita).
 * Mostra horário estimado de chegada em vez de minutos.
 *
 * @param orderNumber - Número do pedido (ex: "PED12345678")
 * @param orderType - "delivery" | "pickup"
 * @param customerName - Nome do cliente para personalizar a mensagem
 * @returns Mensagem formatada pronta para envio via WhatsApp
 */
export function formatConfirmationMessage(
  orderNumber: string,
  orderType: string,
  customerName: string
): string {
  const deliveryTimeRange = calcularTempoEstimado(orderType);
  const now = getNowBRT();
  const dayOfWeek = now.getDay(); // Horário BRT
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const { baseTime, isOutsideHours } = calcularBaseTime(orderType, now);

  // Calcular horário estimado de chegada
  const chegadaMin = new Date(baseTime.getTime() + deliveryTimeRange.min * 60 * 1000);
  const chegadaMax = new Date(baseTime.getTime() + deliveryTimeRange.max * 60 * 1000);
  // Formatar hora diretamente (d já está em BRT, não precisa de timeZone)
  const formatHora = (d: Date) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };
  const horarioEstimado = `${formatHora(chegadaMin)} – ${formatHora(chegadaMax)}`;

  let message = `✅ *Pedido #${orderNumber} Confirmado!*\n\n`;
  message += `Olá, *${customerName}*! 🎉\n`;
  message += `Seu pedido foi *aceito* pelo restaurante e já está sendo preparado com todo carinho! 🔥🍖\n\n`;

  if (orderType === "delivery") {
    message += `🚚 *Previsão de entrega:* ${horarioEstimado}\n`;
    if (isWeekend) {
      message += `_(Fim de semana — pode haver variação no horário)_\n`;
    }
    if (isOutsideHours) {
      message += `_(⚠️ Pedido fora do horário — previsão baseada na próxima abertura)_\n`;
    }
  } else {
    message += `🏦 *Pronto para retirada às:* ${horarioEstimado}\n`;
  }

  message += `\n_Obrigado pela preferência! ❤️_`;

  return message;
}

/**
 * Envia notificação de pedido recebido para WhatsApp do cliente
 * Tenta envio direto; se falhar, salva na fila
 */
export async function notifyWhatsAppBot(
  orderId: number,
  sessionId: string,
  whatsappNumber?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  // Formatar mensagem
  const message = await formatOrderForWhatsApp(orderId);
  const phone = whatsappNumber || null;

  // Tentar envio direto via Evolution API (com fallback para WhatsApp Cloud API)
  if (phone) {
    const sent = await sendWhatsAppMessage(phone, message);
    if (sent) {
      logger.info("Notification", `Mensagem de recebimento enviada diretamente para ${phone}`);
      return;
    }
  }

  // Fallback: salvar na fila (normalizar telefone para formato 55XXXXXXXXXXX)
  await db.insert(botMessages).values({
    sessionId,
    whatsappNumber: phone ? phoneNormalizer.withCountryCode(phone) : phone,
    message,
    messageType: "order_confirmation",
    status: "pending",
  });
}

/**
 * Formata atualização de status para WhatsApp
 */
export function formatStatusUpdateForWhatsApp(
  orderNumber: string,
  status: string,
  orderType: string,
  customerName: string,
  estimatedTime?: number
): string {
  if (status === "confirmed") {
    return formatConfirmationMessage(orderNumber, orderType, customerName);
  }

  const statusMessages: Record<string, string> = {
    preparing: `👨‍🍳 *Pedido #${orderNumber} em Preparo*\n\nNossa equipe está preparando seu pedido com todo carinho! 🍖`,
    ready: `✨ *Pedido #${orderNumber} Pronto!*\n\nSeu pedido está pronto para retirada! 🎉`,
    delivering: `🚚 *Pedido #${orderNumber} Saiu para Entrega!*\n\nSeu pedido está a caminho! ${estimatedTime ? `Previsão: ${estimatedTime} minutos 🏍️` : ""}`,
    delivered: `🎉 *Pedido #${orderNumber} Entregue!*\n\nEsperamos que aproveite muito! Obrigado pela preferência! ❤️\n\n_Churrascaria Estrela do Sul 🌟_`,
    cancelled: `❌ *Pedido #${orderNumber} Cancelado*\n\nSeu pedido foi cancelado. Entre em contato conosco para mais informações.\n📞 Telefone fixo: (17) 3325-8628`,
  };

  return statusMessages[status] || `Pedido #${orderNumber} — Status atualizado: ${status}`;
}

/**
 * Envia atualização de status para WhatsApp do cliente
 * Tenta envio direto; se falhar, salva na fila
 */
export async function notifyStatusUpdate(
  orderId: number,
  newStatus: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  // Buscar pedido
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new Error("Pedido não encontrado");
  }

  // Formatar mensagem com dados corretos
  const message = formatStatusUpdateForWhatsApp(
    order.orderNumber,
    newStatus,
    order.orderType || "delivery",
    order.customerName || "Cliente",
    order.estimatedTime || undefined
  );

  // Preferir o whatsappNumber da sessão (já tem DDI 55), fallback para customerPhone
  let phone = order.customerPhone;
  if (order.sessionId) {
    const [session] = await db
      .select({ whatsappNumber: orderSessions.whatsappNumber })
      .from(orderSessions)
      .where(eq(orderSessions.sessionId, order.sessionId))
      .limit(1);
    if (session?.whatsappNumber) {
      phone = session.whatsappNumber;
    }
  }

  // Tentar envio direto via Evolution API (com fallback para WhatsApp Cloud API)
  if (phone) {
    const sent = await sendWhatsAppMessage(phone, message);
    if (sent) {
      logger.info("Notification", `Status '${newStatus}' enviado diretamente para ${phone}`);
      return;
    }
  }

  // Fallback: salvar na fila (normalizar telefone para formato 55XXXXXXXXXXX)
  await db.insert(botMessages).values({
    sessionId: order.sessionId || `order_${order.id}`,
    whatsappNumber: phone ? phoneNormalizer.withCountryCode(phone) : phone,
    message,
    messageType: "order_status_update",
    status: "pending",
  });
}
