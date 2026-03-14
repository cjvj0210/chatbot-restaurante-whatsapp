/**
 * Chatbot Action Handler
 *
 * Handles special markers injected by the LLM into its response:
 *   [GERAR_LINK_PEDIDO]               → create order session and replace with real link
 *   [VERIFICAR_STATUS_PEDIDO:PEDXXXX] → look up real order status from DB
 *   [SALVAR_RESERVA:key=val;...]       → save reservation to DB
 *   [CHAMAR_ATENDENTE]                 → activate human mode (handled in chatbot.ts orchestrator)
 */

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orderSessions, orders, reservations } from "../../drizzle/schema";
import { getNowBRT, checkBusinessHours } from "../../shared/businessHours";
import { notifyOwner } from "../_core/notification";
import { logger } from "../utils/logger";
import { getSiteUrl } from "../_core/siteUrl";

/**
 * Processa [GERAR_LINK_PEDIDO] — cria uma order session e substitui o placeholder
 * pelo link real do cardápio digital.
 *
 * @param aiResponse - Texto completo retornado pelo LLM (pode conter o marcador)
 * @param phone - Número do cliente (normalizado, sem DDI) para associar à sessão
 * @returns Texto com o marcador substituído pelo link real, ou mensagem de fallback em caso de erro
 */
export async function handleOrderLink(aiResponse: string, phone: string): Promise<string> {
  if (!aiResponse.includes("[GERAR_LINK_PEDIDO]")) return aiResponse;

  try {
    const db = await getDb();
    if (db) {
      const sessionId = randomBytes(16).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(orderSessions).values({
        sessionId,
        whatsappNumber: phone,
        customerId: null,
        status: "pending",
        expiresAt,
      });
      const orderLink = `${getSiteUrl()}/pedido/${sessionId}`;
      // Link em linha isolada (iOS exige URL sozinha na linha para ser clicável)
      aiResponse = aiResponse.replace(/\[GERAR_LINK_PEDIDO\]/g, `\n${orderLink}\n`);
      aiResponse = aiResponse.replace(/\n{3,}/g, "\n\n");
      logger.info("ActionHandler", `Link de pedido gerado para ${phone}: ${orderLink}`);
    } else {
      aiResponse = aiResponse.replace(/\[GERAR_LINK_PEDIDO\]/g, "(link temporariamente indisponível)");
    }
  } catch (err) {
    logger.error("ActionHandler", "Erro ao gerar link de pedido", err);
    aiResponse = aiResponse.replace(/\[GERAR_LINK_PEDIDO\]/g, "(link temporariamente indisponível)");
  }

  return aiResponse;
}

/**
 * Calcula a mensagem de previsão de entrega para pedidos delivery.
 * Separado de handleOrderStatus para reduzir complexidade ciclomática.
 */
function calcularPrevisaoDelivery(
  minutesElapsed: number,
  isOpenNow: boolean,
  isWeekend: boolean,
  nowBRT: Date
): string {
  const deliveryMinMinutes = isWeekend ? 60 : 45;
  const deliveryMaxMinutes = isWeekend ? 110 : 70;
  const minRemaining = Math.max(0, deliveryMinMinutes - minutesElapsed);
  const maxRemaining = Math.max(0, deliveryMaxMinutes - minutesElapsed);

  if (!isOpenNow && minutesElapsed < deliveryMinMinutes) {
    const currentHour = nowBRT.getHours();
    let nextOpenHour = 11;
    if (currentHour >= 15 && currentHour < 19) nextOpenHour = 19;
    else if (currentHour >= 23 || currentHour < 11) nextOpenHour = 11;
    const estimatedMinStart =
      nextOpenHour * 60 + deliveryMinMinutes - (currentHour * 60 + nowBRT.getMinutes());
    if (estimatedMinStart > 0) {
      const startH = Math.floor((nextOpenHour * 60 + deliveryMinMinutes) / 60) % 24;
      const startM = (nextOpenHour * 60 + deliveryMinMinutes) % 60;
      const endH = Math.floor((nextOpenHour * 60 + deliveryMaxMinutes) / 60) % 24;
      const endM = (nextOpenHour * 60 + deliveryMaxMinutes) % 60;
      return `\n⏱️ Previsão de entrega: entre ${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")} e ${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    }
    return `\n⏱️ Previsão de entrega: ${minRemaining} a ${maxRemaining} min restantes`;
  }

  if (minutesElapsed > deliveryMaxMinutes) {
    return `\n⏱️ Previsão: já deveria ter chegado — qualquer dúvida fale conosco!`;
  }
  if (minutesElapsed >= deliveryMinMinutes) {
    return `\n⏱️ Previsão de entrega: chegando em breve!`;
  }
  return `\n⏱️ Previsão de entrega: ${minRemaining} a ${maxRemaining} min restantes`;
}

/**
 * Calcula a mensagem de previsão de retirada no balcão.
 */
function calcularPrevisaoRetirada(minutesElapsed: number): string {
  const pickupMinMinutes = 30;
  const pickupMaxMinutes = 50;
  const minRemaining = Math.max(0, pickupMinMinutes - minutesElapsed);
  const maxRemaining = Math.max(0, pickupMaxMinutes - minutesElapsed);

  if (minutesElapsed < pickupMinMinutes) {
    return `\n⏱️ Previsão para retirada: ${minRemaining} a ${maxRemaining} min restantes`;
  }
  if (minutesElapsed <= pickupMaxMinutes) {
    return `\n⏱️ Previsão: seu pedido já deve estar pronto!`;
  }
  return `\n⏱️ Previsão: já deve estar pronto — pode vir retirar!`;
}

/**
 * Calcula a mensagem de previsão de entrega/retirada com base no pedido e tempo decorrido.
 */
function calcularPrevisaoStatus(
  orderType: string,
  confirmedAt: Date
): string {
  const now = new Date();
  const minutesElapsed = Math.floor((now.getTime() - confirmedAt.getTime()) / 60000);

  if (orderType !== "delivery") {
    return calcularPrevisaoRetirada(minutesElapsed);
  }

  const nowBRT = getNowBRT();
  const { isOpen: isOpenNow } = checkBusinessHours("delivery", nowBRT);
  const isWeekend = nowBRT.getDay() === 0 || nowBRT.getDay() === 6;
  return calcularPrevisaoDelivery(minutesElapsed, isOpenNow, isWeekend, nowBRT);
}

/**
 * Processa [VERIFICAR_STATUS_PEDIDO:PEDXXXXXXXX] — busca o status real do pedido no banco
 * e substitui o placeholder pelas informações reais.
 *
 * @param aiResponse - Texto completo retornado pelo LLM (pode conter o marcador)
 * @returns Texto com o marcador substituído pelo status real do pedido, ou mensagem de erro
 */
export async function handleOrderStatus(aiResponse: string): Promise<string> {
  const statusMatch = aiResponse.match(/\[VERIFICAR_STATUS_PEDIDO:([A-Z0-9]+)\]/);
  if (!statusMatch) return aiResponse;

  const orderNum = statusMatch[1]!;

  try {
    const db = await getDb();
    if (db) {
      const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNum)).limit(1);
      if (order) {
        const statusMap: Record<string, string> = {
          pending: "⏳ Aguardando aceite do restaurante",
          confirmed: "✅ Pedido confirmado — em preparação",
          preparing: "👨‍🍳 Em preparação na cozinha",
          ready: "✅ Pronto! Aguardando entregador",
          delivering: "🛵 Saiu para entrega!",
          delivered: "✅ Entregue com sucesso!",
          cancelled: "❌ Pedido cancelado",
        };
        const statusText = statusMap[order.status] || order.status;
        const tipoEntrega =
          order.orderType === "pickup"
            ? "Retirada no balcão"
            : `Delivery — ${order.deliveryAddress || "endereço não informado"}`;
        const totalVal = `R$ ${((order.total || 0) / 100).toFixed(2).replace(".", ",")}`;

        let previsaoMsg = "";
        const isActiveStatus = order.status === "confirmed" || order.status === "preparing" || order.status === "delivering";
        if (isActiveStatus && order.confirmedAt) {
          previsaoMsg = calcularPrevisaoStatus(order.orderType, new Date(order.confirmedAt));
        }

        const statusMsg = `📦 *Pedido ${orderNum}*\nStatus: ${statusText}\n${tipoEntrega}\nTotal: ${totalVal}${previsaoMsg}`;
        aiResponse = aiResponse.replace(statusMatch[0]!, statusMsg);
      } else {
        aiResponse = aiResponse.replace(
          statusMatch[0]!,
          `Não encontrei o pedido *${orderNum}*. Verifique o número e tente novamente.`
        );
      }
    } else {
      aiResponse = aiResponse.replace(
        statusMatch[0]!,
        "Sistema temporariamente indisponível. Tente novamente em instantes."
      );
    }
  } catch (err) {
    logger.error("ActionHandler", "Erro ao verificar status do pedido", err);
    aiResponse = aiResponse.replace(
      statusMatch[0]!,
      "Não consegui verificar o status agora. Tente novamente em instantes."
    );
  }

  return aiResponse;
}

/**
 * Processa [SALVAR_RESERVA:nome=X;data=Y;pessoas=N;obs=Z] — salva a reserva no banco
 * e remove o marcador da mensagem enviada ao cliente.
 *
 * @param aiResponse - Texto completo retornado pelo LLM (pode conter o marcador)
 * @param phone - Número do cliente para associar à reserva quando não informado no marcador
 * @returns Texto com o marcador removido (o cliente não deve ver o marcador interno)
 */
export async function handleSaveReservation(aiResponse: string, phone: string): Promise<string> {
  const reservaRegex = /\[SALVAR_RESERVA:([^\]]+)\]/;
  const reservaMatch = aiResponse.match(reservaRegex);
  if (!reservaMatch) return aiResponse;

  try {
    const params: Record<string, string> = {};
    reservaMatch[1]!.split(";").forEach((pair: string) => {
      const [key, ...rest] = pair.split("=");
      if (key) params[key.trim()] = rest.join("=").trim();
    });

    const db = await getDb();
    if (db) {
      const dateStr = new Date().toISOString().slice(0, 8).replace(/-/g, "");
      const suffix = randomBytes(2).toString("hex").toUpperCase();
      const reservationNumber = `RES-${dateStr}-${suffix}`;

      let reservationDate = new Date();
      try {
        if (params.data) {
          const match = params.data.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
          if (match) {
            const [, day, month, year, hour, min] = match;
            reservationDate = new Date(
              parseInt(year!),
              parseInt(month!) - 1,
              parseInt(day!),
              parseInt(hour!),
              parseInt(min!)
            );
          } else {
            const parsed = new Date(params.data);
            if (!isNaN(parsed.getTime())) reservationDate = parsed;
          }
        }
      } catch (dateParseError) {
        logger.warn("ActionHandler", `Falha ao parsear data da reserva: "${params.data}"`, dateParseError);
        // reservationDate permanece como new Date() — reserva será criada com data atual
      }

      const customerPhone = params.telefone || phone;

      await db.insert(reservations).values({
        customerId: null,
        reservationNumber,
        customerName: params.nome || "Cliente via WhatsApp",
        customerPhone,
        date: reservationDate,
        numberOfPeople: parseInt(params.pessoas || "1", 10),
        customerNotes:
          params.obs && params.obs !== "OBSERVACOES" && params.obs.trim() ? params.obs : null,
        status: "pending",
        source: "chatbot",
      });

      logger.info("ActionHandler", `Reserva salva: ${reservationNumber} para ${params.nome} em ${reservationDate.toISOString()}`);

      await notifyOwner({
        title: `📅 Nova reserva via WhatsApp`,
        content: `Nome: ${params.nome || "-"}\nTelefone: ${customerPhone}\nData/Hora: ${params.data || "-"}\nPessoas: ${params.pessoas || "-"}\nObs: ${params.obs && params.obs !== "OBSERVACOES" ? params.obs : "-"}`,
      }).catch((err: unknown) => {
        logger.warn("ActionHandler", "Falha ao notificar dono sobre nova reserva", err);
      });
    }
  } catch (err) {
    logger.error("ActionHandler", "Erro ao salvar reserva", err);
  }

  // Remover o marcador da mensagem enviada ao cliente
  return aiResponse.replace(reservaRegex, "").replace(/\n{3,}/g, "\n\n").trim();
}
