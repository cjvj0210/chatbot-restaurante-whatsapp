import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { verifyWebhook } from "./whatsapp";
import { processIncomingMessage } from "./chatbot";
import { chatSimulatorRouter } from "./chatSimulator";
import { publicTestRouter } from "./publicTest";
import { testConversationsRouter } from "./testConversations";
import { chatbotReservationsRouter } from "./chatbotReservations";
import { getWebhookLogs, clearWebhookLogs } from "./debug";
import { orderLinkRouter } from "./orderLinkRouter";
import { orderRouter } from "./orderRouter";
import { uploadRouter } from "./uploadRouter";
import { whatsappService } from "./services/whatsappService";
import { logger } from "./utils/logger";
import { notifyOwner } from "./_core/notification";
import { logAudit } from "./auditLog";
import { sanitizeInput } from "./sanitize";
import { cached, invalidateCachePrefix } from "./cache";
import { resumeConversationAfterBot } from "./chatbot";
import { deactivateHumanModeForJid } from "./services/humanModeService";
import { phoneNormalizer } from "./utils/phoneNormalizer";

export const appRouter = router({
  system: systemRouter,
  chatSimulator: chatSimulatorRouter,
  publicTest: publicTestRouter,
  testConversations: testConversationsRouter,
  chatbotReservations: chatbotReservationsRouter,
  orderLink: orderLinkRouter,
  order: orderRouter,
  upload: uploadRouter,

  // Cardápio Público (para página de pedidos) — com cache de 60s
  menu: router({
    listCategories: publicProcedure.query(async () => {
      return await cached("menu:categories", () => db.getMenuCategories());
    }),
    listItems: publicProcedure.query(async () => {
      return await cached("menu:items", () => db.getMenuItems());
    }),
    listFeatured: publicProcedure.query(async () => {
      return await cached("menu:featured", () => db.getFeaturedMenuItems());
    }),
  }),
  
  // Debug - Monitoramento de Webhooks (apenas admin)
  debug: router({
    getWebhookLogs: adminProcedure.query(async () => {
      return getWebhookLogs();
    }),
    clearWebhookLogs: adminProcedure.mutation(async () => {
      clearWebhookLogs();
      return { success: true };
    }),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Configurações do Restaurante (apenas admin)
  restaurant: router({
    getSettings: adminProcedure.query(async () => {
      return await db.getRestaurantSettings();
    }),
    updateSettings: adminProcedure
      .input(
        z.object({
          name: z.string(),
          phone: z.string(),
          address: z.string(),
          openingHours: z.string(),
          acceptsDelivery: z.boolean(),
          acceptsReservation: z.boolean(),
          deliveryFee: z.number(),
          minimumOrder: z.number(),
          paymentMethods: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        await db.upsertRestaurantSettings(input);
        return { success: true };
      }),
  }),

  // Configurações do WhatsApp (apenas admin — contém accessToken sensível)
  whatsapp: router({
    getSettings: adminProcedure.query(async () => {
      const settings = await db.getWhatsappSettings();
      if (!settings) return null;
      // Mascarar accessToken: nunca retornar o token completo ao frontend
      return {
        ...settings,
        accessToken: settings.accessToken
          ? `${settings.accessToken.slice(0, 4)}${"*".repeat(Math.max(0, settings.accessToken.length - 8))}${settings.accessToken.slice(-4)}`
          : "",
      };
    }),
    updateSettings: adminProcedure
      .input(
        z.object({
          phoneNumberId: z.string(),
          accessToken: z.string(),
          webhookVerifyToken: z.string(),
          businessAccountId: z.string().optional(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await db.upsertWhatsappSettings(input);
        return { success: true };
      }),
  }),

  // Cardápio - Categorias (apenas admin para mutações)
  menuCategories: router({
    list: adminProcedure.query(async () => {
      return await db.getMenuCategories();
    }),
    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          displayOrder: z.number().default(0),
        })
      )
      .mutation(async ({ input }) => {
        // Validação: impedir categoria com nome duplicado (case-insensitive)
        const existing = await db.getMenuCategories();
        const nameNormalized = input.name.trim().toLowerCase();
        const duplicate = existing.find(c => c.name.trim().toLowerCase() === nameNormalized);
        if (duplicate) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Já existe uma categoria com o nome "${duplicate.name}". Escolha um nome diferente.`,
          });
        }
        const result = await db.createMenuCategory(input);
        invalidateCachePrefix("menu:");
        return result;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          displayOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        // Validação: impedir renomear para um nome já existente em outra categoria (case-insensitive)
        if (data.name) {
          const existing = await db.getMenuCategories();
          const nameNormalized = data.name.trim().toLowerCase();
          const duplicate = existing.find(c => c.id !== id && c.name.trim().toLowerCase() === nameNormalized);
          if (duplicate) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Já existe uma categoria com o nome "${duplicate.name}". Escolha um nome diferente.`,
            });
          }
        }
        await db.updateMenuCategory(id, data);
        invalidateCachePrefix("menu:");
        return { success: true };
      }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteMenuCategory(input.id);
      invalidateCachePrefix("menu:");
      await logAudit({ userId: ctx.user?.id, action: "category.delete", entityType: "menuCategory", entityId: input.id, ipAddress: ctx.req?.ip ?? null });
      return { success: true };
    }),
  }),

  // Cardápio - Itens (apenas admin)
  menuItems: router({
    list: adminProcedure.input(z.object({ categoryId: z.number().optional() }).optional()).query(async ({ input }) => {
      return await db.getMenuItems(input?.categoryId);
    }),
    create: adminProcedure
      .input(
        z.object({
          categoryId: z.number(),
          name: z.string(),
          description: z.string().optional(),
          price: z.number(),
          imageUrl: z.string().optional(),
          preparationTime: z.number().default(30),
        })
      )
      .mutation(async ({ input }) => {
        const result = await db.createMenuItem(input);
        invalidateCachePrefix("menu:");
        return result;
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          categoryId: z.number().optional(),
          name: z.string().optional(),
          description: z.string().optional(),
          price: z.number().optional(),
          imageUrl: z.string().optional(),
          isAvailable: z.boolean().optional(),
          preparationTime: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateMenuItem(id, data);
        invalidateCachePrefix("menu:");
        return { success: true };
      }),
    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteMenuItem(input.id);
      invalidateCachePrefix("menu:");
      await logAudit({ userId: ctx.user?.id, action: "item.delete", entityType: "menuItem", entityId: input.id, ipAddress: ctx.req?.ip ?? null });
      return { success: true };
    }),
  }),

  // Clientes (apenas admin — contém PII)
  customers: router({
    list: adminProcedure.query(async () => {
      return await db.getAllCustomers();
    }),
  }),

  // Pedidos (apenas admin)
  orders: router({
    list: adminProcedure.query(async () => {
      return await db.getAllOrders();
    }),
    getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getOrderById(input.id);
    }),
    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateOrderStatus(input.id, input.status);
        await logAudit({ userId: ctx.user?.id, action: `order.${input.status}`, entityType: "order", entityId: input.id, details: { status: input.status }, ipAddress: ctx.req?.ip ?? null });
        return { success: true };
      }),
  }),

  // Reservas (apenas admin)
  reservations: router({
    list: adminProcedure
      .input(
        z.object({
          date: z.string().optional(), // YYYY-MM-DD
          status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
          showHistory: z.boolean().optional(), // true = mostra tudo, false = só ativas
        }).optional()
      )
      .query(async ({ input }) => {
        return await db.getReservationsFiltered({
          date: input?.date,
          status: input?.status,
          showHistory: input?.showHistory ?? false,
        });
      }),
    getById: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getReservationById(input.id);
    }),
    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateReservationStatus(input.id, input.status);
        await logAudit({ userId: ctx.user?.id, action: `reservation.${input.status}`, entityType: "reservation", entityId: input.id, details: { status: input.status }, ipAddress: ctx.req?.ip ?? null });

        // Enviar notificação WhatsApp ao cliente quando confirmado ou cancelado
        if (input.status === "confirmed" || input.status === "cancelled") {
          try {
            const reservation = await db.getReservationById(input.id);
            if (reservation?.customerPhone) {
              const phone = reservation.customerPhone.replace(/\D/g, "");
              const normalizedPhone = phone.startsWith("55") ? phone : `55${phone}`;

              const dataFormatada = new Date(reservation.date).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              });

              let msg = "";
              if (input.status === "confirmed") {
                msg = `✅ *Reserva Confirmada!*\n\nOlá, *${reservation.customerName}*! 🎉\n\nSua reserva foi *confirmada* pelo restaurante!\n\n📅 *Data:* ${dataFormatada}\n👥 *Pessoas:* ${reservation.numberOfPeople}\n🔖 *Reserva:* #${reservation.reservationNumber}\n\nLembre-se: é importante que 80% do grupo chegue no horário combinado. 👍\n\n_Esperamos você! Churrascaria Estrela do Sul 🌟_`;
              } else {
                msg = `❌ *Reserva Cancelada*\n\nOlá, *${reservation.customerName}*,\n\nInfelizmente não foi possível confirmar sua reserva para ${dataFormatada}.\n\nEntre em contato conosco para reagendar:\n📞 Telefone fixo: (17) 3325-8628\n\n_Churrascaria Estrela do Sul 🌟_`;
              }

              await whatsappService.sendText(normalizedPhone, msg).catch((err: unknown) => {
                logger.warn("Routers", "Falha ao enviar notificação WhatsApp de reserva", err);
              });
            }
          } catch (err) {
            console.error("[Reservations] Erro ao enviar notificação WhatsApp:", err);
          }
        }

        return { success: true };
      }),
  }),

  // Feedback (apenas admin)
  feedback: router({
    list: adminProcedure.query(async () => {
      return await db.getAllFeedback();
    }),
  }),

  // Complementos do Cardápio (Addon Groups e Options)
  menuAddons: router({
    // Leitura pública: busca grupos e opções de um item (necessário para o cardápio do cliente)
    getByItem: publicProcedure
      .input(z.object({ menuItemId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAddonGroupsWithOptions(input.menuItemId);
      }),
    // Leitura pública: busca múltiplos itens de uma vez (para o cardápio completo)
    getByItems: publicProcedure
      .input(z.object({ menuItemIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await db.getAddonGroupsForItems(input.menuItemIds);
      }),
    // Admin: criar grupo de complementos
    createGroup: adminProcedure
      .input(z.object({
        menuItemId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        isRequired: z.boolean().default(false),
        minSelections: z.number().default(0),
        maxSelections: z.number().default(1),
        displayOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        return await db.createAddonGroup(input);
      }),
    // Admin: atualizar grupo
    updateGroup: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        isRequired: z.boolean().optional(),
        minSelections: z.number().optional(),
        maxSelections: z.number().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAddonGroup(id, data);
        return { success: true };
      }),
    // Admin: deletar grupo (e suas opções)
    deleteGroup: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteAddonGroup(input.id);
        await logAudit({ userId: ctx.user?.id, action: "addon.deleteGroup", entityType: "addonGroup", entityId: input.id, ipAddress: ctx.req?.ip ?? null });
        return { success: true };
      }),
    // Admin: criar opção dentro de um grupo
    createOption: adminProcedure
      .input(z.object({
        groupId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        priceExtra: z.number().default(0),
        displayOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        return await db.createAddonOption(input);
      }),
    // Admin: atualizar opção
    updateOption: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        priceExtra: z.number().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAddonOption(id, data);
        return { success: true };
      }),
    // Admin: deletar opção
    deleteOption: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteAddonOption(input.id);
        await logAudit({ userId: ctx.user?.id, action: "addon.deleteOption", entityType: "addonOption", entityId: input.id, ipAddress: ctx.req?.ip ?? null });
        return { success: true };
      }),
  }),

  // Dashboard Stats (apenas admin)
  dashboard: router({
    stats: adminProcedure.query(async () => {
      // Query otimizada: usa COUNT/SUM/AVG no SQL em vez de carregar tudo na memória
      return await db.getDashboardStats();
    }),
  }),

  // Gerenciamento do Modo Humano (apenas admin)
  humanMode: router({
    /**
     * Lista conversas atualmente em modo humano (operador atendendo).
     * Retorna dados do cliente e tempo restante.
     */
    listActive: adminProcedure.query(async () => {
      const convs = await db.getHumanModeConversations();
      return convs.map((c) => ({
        ...c,
        isExpired: c.humanModeUntil ? new Date(c.humanModeUntil) < new Date() : false,
      }));
    }),

    /**
     * Devolve uma conversa ao bot (desativa modo humano).
     * Equivalente ao operador enviar "#bot" no WhatsApp.
     */
    returnToBot: adminProcedure
      .input(
        z.object({
          conversationId: z.number(),
          customerPhone: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const phone = phoneNormalizer.normalize(input.customerPhone);
        const jid = phone;

        // Desativar modo humano no banco e no cache
        await deactivateHumanModeForJid(jid, phone);

        // Retomar conversa automaticamente (gera resposta para mensagem pendente)
        resumeConversationAfterBot(jid, phone).catch((err) =>
          logger.error("Routers", `Erro ao retomar bot para ${phone}`, err)
        );

        await logAudit({
          userId: ctx.user?.id,
          action: "humanMode.returnToBot",
          entityType: "conversation",
          entityId: input.conversationId,
          details: { customerPhone: phone },
          ipAddress: ctx.req?.ip ?? null,
        });

        logger.info("Routers", `Admin devolveu conversa ${input.conversationId} ao bot (cliente: ${phone})`);

        return { success: true, message: `Bot retomado para ${phone}` };
      }),
  }),
});

export type AppRouter = typeof appRouter;
