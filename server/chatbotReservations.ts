/**
 * Router de reservas via chatbot
 * Permite que o Gaúchinho 🤠 colete e salve reservas diretamente
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { reservations } from "../drizzle/schema";

export const chatbotReservationsRouter = router({
  /**
   * Criar nova reserva via chatbot
   * Público pois é chamado pela página /teste sem autenticação
   */
  createReservation: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        customerName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        customerPhone: z.string().min(10, "Telefone inválido"),
        date: z.string(), // ISO string
        numberOfPeople: z.number().int().min(1).max(20), // Máximo 20 pessoas (acima disso vai para atendente)
        customerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Gerar número de reserva único (formato: RES-YYYYMMDD-XXXX)
      const dateStr = new Date(input.date).toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const reservationNumber = `RES-${dateStr}-${randomSuffix}`;

      // Criar reserva no banco
      const [newReservation] = await db.insert(reservations).values({
        customerId: 0, // Temporário - será associado depois quando cliente for identificado
        reservationNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        date: new Date(input.date),
        numberOfPeople: input.numberOfPeople,
        customerNotes: input.customerNotes || null,
        source: "chatbot",
        status: "pending",
        reminderSent: false,
      });

      return {
        success: true,
        reservationNumber,
        message: "Reserva criada com sucesso! Aguarde confirmação.",
      };
    }),

  /**
   * Validar se data/horário aceita reservas
   */
  validateReservation: publicProcedure
    .input(
      z.object({
        date: z.string(), // ISO string
        numberOfPeople: z.number().int().min(1),
      })
    )
    .query(async ({ input }) => {
      const date = new Date(input.date);
      const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
      const hour = date.getHours();

      // Regras de reservas
      const rules = {
        // Sábado à noite (jantar): NÃO aceita reservas
        sabadoNoite: dayOfWeek === 6 && hour >= 19,
        
        // Domingo almoço: NÃO aceita reservas
        domingoAlmoco: dayOfWeek === 0 && hour >= 11 && hour < 15,
        
        // Sexta jantar: aceita reservas até 19:40h
        sextaJantar: dayOfWeek === 5 && hour >= 19,
        
        // Grupos grandes (>20 pessoas): encaminhar para atendente
        grupoGrande: input.numberOfPeople > 20,
      };

      // Verificar se aceita reserva
      if (rules.sabadoNoite) {
        return {
          accepted: false,
          reason: "Sábado à noite não aceitamos reservas. É por ordem de chegada! 😊",
        };
      }

      if (rules.domingoAlmoco) {
        return {
          accepted: false,
          reason: "Domingo no almoço não aceitamos reservas. É por ordem de chegada! 😊",
        };
      }

      if (rules.sextaJantar && hour > 19 && date.getMinutes() > 40) {
        return {
          accepted: false,
          reason: "Sexta à noite aceitamos reservas apenas até 19:40h. Para horários posteriores, é por ordem de chegada! 😊",
        };
      }

      if (rules.grupoGrande) {
        return {
          accepted: false,
          reason: "Para grupos acima de 20 pessoas, preciso te conectar com um atendente humano para fazer um orçamento especial! 👤",
          requiresHuman: true,
        };
      }

      // Aceita reserva
      return {
        accepted: true,
        reason: "Perfeito! Posso anotar sua reserva. 😊",
      };
    }),
});
