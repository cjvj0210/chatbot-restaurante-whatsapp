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
    block += "\n\n📦 PEDIDOS RECENTES DESTE CLIENTE — STATUS EM TEMPO REAL DO BANCO DE DADOS:\n";
    block += "⚠️⚠️⚠️ ATENÇÃO MÁXIMA: O status listado abaixo é o status ATUAL e REAL do pedido, consultado AGORA no banco de dados. Se o histórico de mensagens anteriores mostrar um status diferente (ex: \"aguardando aceite\" quando aqui diz \"Confirmado\"), você DEVE IGNORAR o histórico e usar APENAS o status abaixo. O banco de dados é SEMPRE a fonte de verdade! ⚠️⚠️⚠️\n\n";
    const statusMap: Record<string, string> = {
      pending: "⏳ Aguardando aceite do restaurante",
      confirmed: "✅ CONFIRMADO pelo restaurante — em preparação",
      preparing: "👨‍🍳 Em preparação na cozinha",
      ready: "✅ Pronto para retirada/entrega",
      delivering: "🛵 Saiu para entrega",
      delivered: "✅ Entregue",
      cancelled: "❌ Cancelado",
    };
    for (const o of recentOrders) {
      const st = statusMap[o.status] || o.status;
      const total = `R$ ${((o.total || 0) / 100).toFixed(2).replace(".", ",")}`;
      const tipo = o.orderType === "pickup" ? "Retirada" : "Delivery";
      block += `→ Pedido ${o.orderNumber}: ${st} | ${tipo} | ${total}\n`;
    }

    // Usar o primeiro pedido como referência para a regra de verificação
    const firstOrderNum = recentOrders[0]!.orderNumber;
    block += "\nREGRAS OBRIGATÓRIAS SOBRE PEDIDOS:\n";
    block += `1. Se o cliente perguntar sobre tempo, status ou demora, use [VERIFICAR_STATUS_PEDIDO:${firstOrderNum}] para buscar o status ATUALIZADO. NÃO peça o número do pedido se já tem acima!\n`;
    block += "2. NUNCA contradiga o status listado acima. Se acima diz \"CONFIRMADO\", o pedido JÁ FOI ACEITO. NÃO diga \"aguardando aceite\".\n";
    block += "3. Se o status acima diz \"Confirmado\" e o cliente pergunta se foi aceito, responda SIM, já foi confirmado.\n";
    block += "4. SEMPRE confie no status listado AQUI (banco de dados), nunca no que foi dito em mensagens anteriores do histórico.\n";
    block += "5. Se o cliente questionar uma contradição com mensagem anterior, peça desculpas e informe o status CORRETO (o que está listado aqui).\n";
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
