import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
import { sendTextMessageEvolution } from "./evolutionApi";
import { notifyOwner } from "./_core/notification";
import { logAudit } from "./auditLog";
import { sanitizeInput } from "./sanitize";
import { cached, invalidateCachePrefix } from "./cache";

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
  
  // Debug - Monitoramento de Webhooks
  debug: router({
    getWebhookLogs: protectedProcedure.query(async () => {
      return getWebhookLogs();
    }),
    clearWebhookLogs: protectedProcedure.mutation(async () => {
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

  // Configurações do Restaurante
  restaurant: router({
    getSettings: protectedProcedure.query(async () => {
      return await db.getRestaurantSettings();
    }),
    updateSettings: protectedProcedure
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

  // Configurações do WhatsApp
  whatsapp: router({
    getSettings: protectedProcedure.query(async () => {
      return await db.getWhatsappSettings();
    }),
    updateSettings: protectedProcedure
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

  // Cardápio - Categorias
  menuCategories: router({
    list: protectedProcedure.query(async () => {
      return await db.getMenuCategories();
    }),
    create: protectedProcedure
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
    update: protectedProcedure
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
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteMenuCategory(input.id);
      invalidateCachePrefix("menu:");
      await logAudit({ userId: ctx.user?.id, action: "category.delete", entityType: "menuCategory", entityId: input.id });
      return { success: true };
    }),
  }),

  // Cardápio - Itens
  menuItems: router({
    list: protectedProcedure.input(z.object({ categoryId: z.number().optional() }).optional()).query(async ({ input }) => {
      return await db.getMenuItems(input?.categoryId);
    }),
    create: protectedProcedure
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
    update: protectedProcedure
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
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteMenuItem(input.id);
      invalidateCachePrefix("menu:");
      await logAudit({ userId: ctx.user?.id, action: "item.delete", entityType: "menuItem", entityId: input.id });
      return { success: true };
    }),
  }),

  // Clientes
  customers: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCustomers();
    }),
  }),

  // Pedidos
  orders: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllOrders();
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getOrderById(input.id);
    }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateOrderStatus(input.id, input.status);
        await logAudit({ userId: ctx.user?.id, action: `order.${input.status}`, entityType: "order", entityId: input.id, details: { status: input.status } });
        return { success: true };
      }),
  }),

  // Reservas
  reservations: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllReservations();
    }),
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getReservationById(input.id);
    }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateReservationStatus(input.id, input.status);
        await logAudit({ userId: ctx.user?.id, action: `reservation.${input.status}`, entityType: "reservation", entityId: input.id, details: { status: input.status } });

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
                msg = `❌ *Reserva Cancelada*\n\nOlá, *${reservation.customerName}*,\n\nInfelizmente não foi possível confirmar sua reserva para ${dataFormatada}.\n\nEntre em contato conosco para reagendar:\n📞 (17) 9 8212-3269\n\n_Churrascaria Estrela do Sul 🌟_`;
              }

              await sendTextMessageEvolution(normalizedPhone, msg).catch(() => {});
            }
          } catch (err) {
            console.error("[Reservations] Erro ao enviar notificação WhatsApp:", err);
          }
        }

        return { success: true };
      }),
  }),

  // Feedback
  feedback: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllFeedback();
    }),
  }),

  // Complementos do Cardápio (Addon Groups e Options)
  menuAddons: router({
    // Leitura pública: busca grupos e opções de um item
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
    createGroup: protectedProcedure
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
    updateGroup: protectedProcedure
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
    deleteGroup: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteAddonGroup(input.id);
        await logAudit({ userId: ctx.user?.id, action: "addon.deleteGroup", entityType: "addonGroup", entityId: input.id });
        return { success: true };
      }),
    // Admin: criar opção dentro de um grupo
    createOption: protectedProcedure
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
    updateOption: protectedProcedure
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
    deleteOption: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteAddonOption(input.id);
        await logAudit({ userId: ctx.user?.id, action: "addon.deleteOption", entityType: "addonOption", entityId: input.id });
        return { success: true };
      }),
  }),

  // Dashboard Stats
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      // Query otimizada: usa COUNT/SUM/AVG no SQL em vez de carregar tudo na memória
      return await db.getDashboardStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
