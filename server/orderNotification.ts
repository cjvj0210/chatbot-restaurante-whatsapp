import { getDb } from "./db";
import { botMessages, orders, orderItems, menuItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Formata valor em centavos para Real brasileiro
 */
function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Formata pedido para mensagem WhatsApp
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

  // Montar mensagem
  let message = `⏳ *Pedido #${order.orderNumber} Recebido!*\n\n`;
  
  message += `👤 *Cliente:* ${order.customerName}\n`;
  message += `📱 *Telefone:* ${order.customerPhone}\n\n`;

  message += `📦 *Itens:*\n`;
  for (const item of items) {
    const itemTotal = item.quantity * item.unitPrice;
    message += `• ${item.quantity}x ${item.name} - ${formatCurrency(itemTotal)}\n`;
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
    message += `⏰ *Previsão de entrega:* ${order.estimatedTime || 40}-${(order.estimatedTime || 40) + 10} minutos\n\n`;
  } else {
    message += `🏪 *Retirada no local*\n\n`;
    message += `⏰ *Estará pronto em:* ${order.estimatedTime || 30} minutos\n\n`;
  }

  message += `💳 *Forma de pagamento:* ${order.paymentMethod}\n\n`;

  if (order.customerNotes) {
    message += `📝 *Observações:*\n${order.customerNotes}\n\n`;
  }

  message += `⏳ *Aguardando aceite do restaurante...*\n\n`;
  message += `_Você será avisado assim que o restaurante confirmar seu pedido._`;

  return message;
}

/**
 * Envia notificação de pedido para WhatsApp
 * Adiciona mensagem na fila para ser processada pelo bot
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

  // Adicionar na fila de mensagens
  await db.insert(botMessages).values({
    sessionId,
    whatsappNumber: whatsappNumber || null,
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
  estimatedTime?: number
): string {
  const statusMessages: Record<string, string> = {
    confirmed: `✅ *Pedido #${orderNumber} Aceito e Confirmado!*\n\nO restaurante aceitou seu pedido e já está sendo preparado! 🔥`,
    preparing: `👨‍🍳 *Pedido #${orderNumber} em Preparo*\n\nNossa equipe está preparando seu pedido com todo carinho! 🍖`,
    ready: `✨ *Pedido #${orderNumber} Pronto!*\n\nSeu pedido está pronto para retirada! 🎉`,
    delivering: `🚚 *Pedido #${orderNumber} Saiu para Entrega*\n\nSeu pedido está a caminho! ${estimatedTime ? `Previsão: ${estimatedTime} minutos` : ""}`,
    delivered: `🎉 *Pedido #${orderNumber} Entregue!*\n\nEsperamos que aproveite! Obrigado pela preferência! ❤️`,
    cancelled: `❌ *Pedido #${orderNumber} Cancelado*\n\nSeu pedido foi cancelado. Entre em contato conosco para mais informações.`,
  };

  return statusMessages[status] || `Pedido #${orderNumber} - Status: ${status}`;
}

/**
 * Envia atualização de status para WhatsApp
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

  // Formatar mensagem
  const message = formatStatusUpdateForWhatsApp(
    order.orderNumber,
    newStatus,
    order.estimatedTime || undefined
  );

  // Adicionar na fila de mensagens
  await db.insert(botMessages).values({
    sessionId: order.sessionId || `order_${order.id}`,
    whatsappNumber: order.customerPhone,
    message,
    messageType: "order_status_update",
    status: "pending",
  });
}
