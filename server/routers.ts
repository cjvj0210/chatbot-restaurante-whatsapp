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

export const appRouter = router({
  system: systemRouter,
  chatSimulator: chatSimulatorRouter,
  publicTest: publicTestRouter,
  testConversations: testConversationsRouter,
  chatbotReservations: chatbotReservationsRouter,
  orderLink: orderLinkRouter,
  order: orderRouter,
  upload: uploadRouter,

  // Cardápio Público (para página de pedidos)
  menu: router({
    listCategories: publicProcedure.query(async () => {
      return await db.getMenuCategories();
    }),
    listItems: publicProcedure.query(async () => {
      return await db.getMenuItems();
    }),
    listFeatured: publicProcedure.query(async () => {
      return await db.getFeaturedMenuItems();
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
        return await db.createMenuCategory(input);
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
        await db.updateMenuCategory(id, data);
        return { success: true };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMenuCategory(input.id);
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
        return await db.createMenuItem(input);
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
        return { success: true };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteMenuItem(input.id);
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
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
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
      .mutation(async ({ input }) => {
        await db.updateReservationStatus(input.id, input.status);
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
      .mutation(async ({ input }) => {
        await db.deleteAddonGroup(input.id);
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
      .mutation(async ({ input }) => {
        await db.deleteAddonOption(input.id);
        return { success: true };
      }),
  }),

  // Dashboard Stats
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      const orders = await db.getAllOrders();
      const reservations = await db.getAllReservations();
      const customers = await db.getAllCustomers();
      const feedbackList = await db.getAllFeedback();

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
      const pendingOrders = orders.filter((o) => o.status === "pending").length;
      const activeReservations = reservations.filter((r) => r.status === "confirmed").length;
      const totalCustomers = customers.length;
      const averageRating = feedbackList.length > 0
        ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length
        : 0;

      return {
        totalOrders,
        totalRevenue,
        pendingOrders,
        activeReservations,
        totalCustomers,
        averageRating,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
