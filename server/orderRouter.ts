import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { orders, orderItems, orderSessions, menuItems } from "../drizzle/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { notifyWhatsAppBot, notifyStatusUpdate } from "./orderNotification";

/**
 * Router para gerenciamento de pedidos
 */
export const orderRouter = router({
  /**
   * Criar novo pedido via cardápio web
   */
  create: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        customerName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        customerPhone: z.string().min(10, "Telefone inválido"),
        deliveryType: z.enum(["delivery", "pickup"]),
        address: z.string().optional(),
        paymentMethod: z.enum(["dinheiro", "cartao", "pix"]),
        changeFor: z.number().optional(),
        additionalNotes: z.string().optional(),
        totalAmount: z.number(),
        items: z.array(
          z.object({
            menuItemId: z.number(),
            quantity: z.number().min(1),
            price: z.number(),
            observations: z.string().optional(),
          })
        ).min(1, "Pedido deve ter pelo menos 1 item"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      // Validar sessão
      const [session] = await db
        .select()
        .from(orderSessions)
        .where(eq(orderSessions.sessionId, input.sessionId))
        .limit(1);

      if (!session) {
        throw new Error("Sessão inválida");
      }

      if (new Date() > new Date(session.expiresAt)) {
        throw new Error("Sessão expirada");
      }

      if (session.status === "completed") {
        throw new Error("Sessão já foi utilizada");
      }

      // Buscar itens do menu para calcular preços
      const itemIds = input.items.map((item) => item.menuItemId);
      const itemsData = await db
        .select()
        .from(menuItems)
        .where(inArray(menuItems.id, itemIds));

      if (itemsData.length !== input.items.length) {
        throw new Error("Alguns itens do pedido não foram encontrados");
      }

      // Calcular subtotal
      let subtotal = 0;
      const orderItemsData = input.items.map((item) => {
        const menuItem = itemsData.find((mi) => mi.id === item.menuItemId);
        if (!menuItem) throw new Error(`Item ${item.menuItemId} não encontrado`);
        
        const itemTotal = menuItem.price * item.quantity;
        subtotal += itemTotal;
        
        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          observations: item.observations || null,
          addons: null,
        };
      });

      // Taxa de entrega (buscar das configurações ou usar padrão)
      const deliveryFee = input.deliveryType === "delivery" ? 850 : 0; // R$ 8,50

      // Total
      const total = input.totalAmount + deliveryFee;

      // Gerar número do pedido (timestamp + random)
      const orderNumber = `PED${Date.now().toString().slice(-8)}`;

      // Criar pedido
      const result = await db
        .insert(orders)
        .values({
          sessionId: input.sessionId,
          customerId: session.customerId || null,
          orderNumber,
          status: "pending",
          orderType: input.deliveryType,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          items: JSON.stringify(input.items), // Manter para compatibilidade
          subtotal,
          deliveryFee,
          total,
          deliveryAddress: input.address || null,
          customerNotes: input.additionalNotes || null,
          paymentMethod: input.paymentMethod,
          estimatedTime: 40, // 40 minutos padrão
        });

      // Buscar pedido criado
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .limit(1);

      if (!order) {
        throw new Error("Erro ao criar pedido");
      }

      // Criar itens do pedido (normalizado)
      for (const itemData of orderItemsData) {
        await db.insert(orderItems).values({
          orderId: order.id,
          ...itemData,
        });
      }

      // Marcar sessão como completa
      await db
        .update(orderSessions)
        .set({ status: "completed" })
        .where(eq(orderSessions.id, session.id));

      // Enviar notificação para WhatsApp
      try {
        await notifyWhatsAppBot(
          order.id,
          input.sessionId,
          session.whatsappNumber || input.customerPhone
        );
      } catch (error) {
        console.error("Erro ao enviar notificação WhatsApp:", error);
        // Não falhar o pedido se notificação falhar
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total,
        estimatedTime: order.estimatedTime,
        status: order.status,
      };
    }),

  /**
   * Buscar pedido por sessionId
   */
  getBySession: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.sessionId, input.sessionId))
        .limit(1);

      if (!order) {
        return null;
      }

      // Buscar itens do pedido
      const items = await db
        .select({
          id: orderItems.id,
          menuItemId: orderItems.menuItemId,
          menuItemName: menuItems.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          observations: orderItems.observations,
          addons: orderItems.addons,
        })
        .from(orderItems)
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(eq(orderItems.orderId, order.id));

      return {
        ...order,
        items,
      };
    }),

  /**
   * Buscar pedido por ID (para impressão)
   */
  getById: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!order) {
        return null;
      }

      // Buscar itens do pedido
      const items = await db
        .select({
          id: orderItems.id,
          menuItemId: orderItems.menuItemId,
          menuItemName: menuItems.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          observations: orderItems.observations,
          addons: orderItems.addons,
        })
        .from(orderItems)
        .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(eq(orderItems.orderId, order.id));

      return {
        ...order,
        items,
      };
    }),

  /**
   * Listar todos os pedidos (admin)
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      let query = db.select().from(orders);

      if (input?.status) {
        query = query.where(eq(orders.status, input.status)) as any;
      }

      const ordersList = await query
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      return ordersList;
    }),

  /**
   * Atualizar status do pedido (admin)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      await db
        .update(orders)
        .set({ status: input.status })
        .where(eq(orders.id, input.orderId));

      // Buscar pedido atualizado
      const [updated] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!updated) {
        throw new Error("Pedido não encontrado");
      }

      // Enviar notificação de atualização de status
      try {
        await notifyStatusUpdate(input.orderId, input.status);
      } catch (error) {
        console.error("Erro ao enviar notificação de status:", error);
        // Não falhar a atualização se notificação falhar
      }

      return {
        success: true,
        order: updated,
      };
    }),
});
