/**
 * Customer Context Builder
 *
 * Builds the LLM context block injected into the system prompt
 * with recent orders and active reservations for the current customer.
 */

import { getRecentOrdersByCustomer, getActiveReservationsByCustomer } from "../db";

/**
 * Sanitiza um campo de texto vindo de dados controlados pelo cliente
 * antes de injetar no prompt do LLM — previne prompt injection indireto.
 */
function sanitizeContextField(s: string | null | undefined, maxLen = 100): string {
  if (!s) return "";
  return s
    .replace(/\[[\w_:]+\]/g, "[dado_removido]")
    .replace(/\bsystem\b/gi, "")
    .replace(/\bassistant\b/gi, "")
    .slice(0, maxLen);
}

/**
 * Retorna um bloco de texto com pedidos recentes e reservas ativas do cliente
 * para ser injetado no system prompt do LLM.
 */
export async function buildCustomerContextBlock(customerId: number): Promise<string> {
  const [recentOrders, activeReservations] = await Promise.all([
    getRecentOrdersByCustomer(customerId),
    getActiveReservationsByCustomer(customerId),
  ]);

  let block = "";

  if (recentOrders.length > 0) {
    block += "\n\n📦 PEDIDOS RECENTES DESTE CLIENTE (últimas 24h):\n";
    const statusMap: Record<string, string> = {
      pending: "Aguardando aceite",
      confirmed: "Confirmado",
      preparing: "Em preparação",
      ready: "Pronto",
      delivering: "Saiu para entrega",
      delivered: "Entregue",
      cancelled: "Cancelado",
    };
    for (const o of recentOrders) {
      const st = statusMap[o.status] || o.status;
      const total = `R$ ${((o.total || 0) / 100).toFixed(2).replace(".", ",")}`;
      const tipo = o.orderType === "pickup" ? "Retirada" : "Delivery";
      block += `- Pedido ${o.orderNumber}: ${st} | ${tipo} | ${total}\n`;
    }
    block +=
      "REGRA: Se o cliente perguntar sobre tempo, status ou demora, use o número do pedido acima para verificar com [VERIFICAR_STATUS_PEDIDO:PEDXXXXXXXX]. NÃO peça o número do pedido se já tem a informação acima!";
  }

  if (activeReservations.length > 0) {
    block += "\n\n📅 RESERVAS ATIVAS DESTE CLIENTE:\n";
    for (const r of activeReservations) {
      const dataRes = r.date
        ? new Date(r.date).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "data não definida";
      const safeName = sanitizeContextField(r.customerName);
      block += `- Reserva ${r.reservationNumber}: ${safeName} | ${r.numberOfPeople} pessoas | ${dataRes} | Status: ${r.status}\n`;
    }
    block +=
      "REGRA: Se o cliente perguntar sobre reserva, use as informações acima. NÃO diga que não sabe sobre a reserva!";
  }

  return block;
}
