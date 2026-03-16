import { getDb } from "./db";
import { reservations } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { whatsappService } from "./services/whatsappService";

/**
 * Verifica reservas que estão a ~12h de acontecer e envia lembrete via WhatsApp.
 * Deve ser chamado a cada 15 minutos pelo cron job interno.
 */
export async function sendReservationReminders(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();

    // Janela: reservas que acontecem entre 11h45 e 12h15 a partir de agora
    const windowStart = new Date(now.getTime() + 11 * 60 * 60 * 1000 + 45 * 60 * 1000); // +11h45
    const windowEnd   = new Date(now.getTime() + 12 * 60 * 60 * 1000 + 15 * 60 * 1000); // +12h15

    // Buscar reservas confirmadas ou pendentes nessa janela que ainda não receberam lembrete
    const pendingReminders = await db
      .select()
      .from(reservations)
      .where(
        and(
          gte(reservations.date, windowStart),
          lte(reservations.date, windowEnd),
          eq(reservations.reminderSent, false)
        )
      );

    for (const reservation of pendingReminders) {
      if (!reservation.customerPhone) continue;

      const phone = reservation.customerPhone.replace(/\D/g, "");
      const normalizedPhone = phone.startsWith("55") ? phone : `55${phone}`;

      const dataFormatada = new Date(reservation.date).toLocaleString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });

      const msg =
        `🔔 *Lembrete de Reserva!*\n\n` +
        `Olá, *${reservation.customerName}*! 😊\n\n` +
        `Sua reserva na *Churrascaria Estrela do Sul* está marcada para *${dataFormatada}* — ou seja, em aproximadamente 12 horas!\n\n` +
        `👥 *Pessoas:* ${reservation.numberOfPeople}\n` +
        `🔖 *Reserva:* #${reservation.reservationNumber}\n\n` +
        `Lembre-se: é importante que 80% do grupo chegue no horário combinado. 👍\n\n` +
        `_Qualquer dúvida, entre em contato: 📞 Telefone fixo: (17) 3325-8628_\n\n` +
        `_Churrascaria Estrela do Sul 🌟_`;

      const sent = await whatsappService.sendText(normalizedPhone, msg).catch(() => false);

      if (sent) {
        // Marcar lembrete como enviado
        await db
          .update(reservations)
          .set({ reminderSent: true })
          .where(eq(reservations.id, reservation.id));

        console.log(`[Reminder] Lembrete enviado para ${reservation.customerName} (${normalizedPhone}) — reserva ${reservation.reservationNumber}`);
      }
    }
  } catch (err) {
    console.error("[Reminder] Erro ao processar lembretes de reserva:", err);
  }
}
