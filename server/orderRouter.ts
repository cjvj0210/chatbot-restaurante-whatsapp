import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { orders, orderItems, orderSessions, menuItems, customers } from "../drizzle/schema";
import { eq, desc, inArray, like } from "drizzle-orm";
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
        changeFor: z.number().optional(), // valor em centavos para troco
        additionalNotes: z.string().optional(),
        birthDate: z.string().optional(), // formato DD/MM/AAAA
        totalAmount: z.number(),
        items: z.array(
          z.object({
            menuItemId: z.number(),
            quantity: z.number().min(1),
            price: z.number(),
            observations: z.string().optional(),
            addons: z.array(z.object({
              groupId: z.number(),
              groupName: z.string(),
              optionId: z.number(),
              optionName: z.string(),
              priceExtra: z.number(),
              quantity: z.number().optional(),
            })).optional(),
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
          itemName: menuItem.name, // salvar nome no momento do pedido
          itemImageUrl: menuItem.imageUrl || null, // salvar imagem no momento do pedido
          observations: item.observations || null,
          addons: item.addons && item.addons.length > 0 ? JSON.stringify(item.addons) : null,
        };
      });

      // Taxa de entrega (buscar das configurações ou usar padrão)
      const deliveryFee = input.deliveryType === "delivery" ? 850 : 0; // R$ 8,50

      // Total
      const total = input.totalAmount + deliveryFee;

      // Gerar número do pedido (timestamp + random)
      const orderNumber = `PED${Date.now().toString().slice(-8)}`;

      // Criar pedido
      // Normalizar telefone: remover tudo que não é dígito para garantir consistência nas buscas
      const normalizedPhone = input.customerPhone.replace(/\D/g, "");

      const result = await db
        .insert(orders)
        .values({
          sessionId: input.sessionId,
          customerId: session.customerId || null,
          orderNumber,
          status: "pending",
          orderType: input.deliveryType,
          customerName: input.customerName,
          customerPhone: normalizedPhone,
          items: JSON.stringify(input.items), // Manter para compatibilidade
          subtotal,
          deliveryFee,
          total,
          deliveryAddress: input.address || null,
          customerNotes: input.additionalNotes || null,
          paymentMethod: input.paymentMethod,
          changeFor: input.changeFor || null,
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

      // Atualizar dados do cliente no banco (endereço e nome sempre que fizer pedido)
      if (session.customerId) {
        try {
          const customerUpdate: Record<string, any> = {};
          // Atualizar nome se foi fornecido
          if (input.customerName) {
            customerUpdate.name = input.customerName;
          }
          // Atualizar endereço se for delivery e tiver endereço
          if (input.deliveryType === "delivery" && input.address) {
            customerUpdate.address = input.address;
          }
          // Salvar data de nascimento apenas se ainda não tiver (não sobrescrever)
          if (input.birthDate) {
            const [existingCustomer] = await db.select().from(customers).where(eq(customers.id, session.customerId!)).limit(1);
            if (existingCustomer && !existingCustomer.birthDate) {
              customerUpdate.birthDate = input.birthDate;
            }
          }
          if (Object.keys(customerUpdate).length > 0) {
            await db.update(customers).set(customerUpdate).where(eq(customers.id, session.customerId));
          }
        } catch (err) {
          console.error("Erro ao atualizar dados do cliente:", err);
          // Não falhar o pedido se atualização do cliente falhar
        }
      }

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
        dateFrom: z.string().optional(), // formato YYYY-MM-DD
        dateTo: z.string().optional(),   // formato YYYY-MM-DD
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database connection failed");
      }

      const limit = input?.limit || 20;
      const offset = input?.offset || 0;

      const { and: andOp, gte, lte } = await import("drizzle-orm");

      const conditions: any[] = [];
      if (input?.status) {
        conditions.push(eq(orders.status, input.status));
      }
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom + "T00:00:00.000Z");
        conditions.push(gte(orders.createdAt, from));
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo + "T23:59:59.999Z");
        conditions.push(lte(orders.createdAt, to));
      }

      let query = db.select().from(orders);
      if (conditions.length > 0) {
        query = query.where(conditions.length === 1 ? conditions[0] : andOp(...conditions)) as any;
      }

      const ordersList = await query
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      // Buscar itens normalizados com nomes para cada pedido
      const ordersWithItems = await Promise.all(
        ordersList.map(async (order) => {
          const items = await db
            .select({
              id: orderItems.id,
              menuItemId: orderItems.menuItemId,
              name: menuItems.name,
              quantity: orderItems.quantity,
              price: orderItems.unitPrice,
              observations: orderItems.observations,
              addons: orderItems.addons,
            })
            .from(orderItems)
            .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
            .where(eq(orderItems.orderId, order.id));
          return { ...order, orderItemsList: items };
        })
      );

      return ordersWithItems;
    }),

  /**
   * Buscar histórico de pedidos por telefone do cliente (admin)
   */
  getByPhone: protectedProcedure
    .input(
      z.object({
        phone: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      // Normalizar telefone: remover tudo exceto dígitos
      const digits = input.phone.replace(/\D/g, "");
      const ordersList = await db
        .select()
        .from(orders)
        .where(like(orders.customerPhone, `%${digits.slice(-8)}%`))
        .orderBy(desc(orders.createdAt))
        .limit(20);
      const ordersWithItems = await Promise.all(
        ordersList.map(async (order) => {
          const items = await db
            .select({
              id: orderItems.id,
              name: menuItems.name,
              quantity: orderItems.quantity,
              price: orderItems.unitPrice,
            })
            .from(orderItems)
            .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
            .where(eq(orderItems.orderId, order.id));
          return { ...order, orderItemsList: items };
        })
      );
      return ordersWithItems;
    }),

  /**
   * Buscar dados do cliente pelo número de WhatsApp (pré-preenchimento no cardápio)
   */
  getCustomerByWhatsapp: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      // Buscar sessão para obter o whatsappNumber
      const [session] = await db
        .select()
        .from(orderSessions)
        .where(eq(orderSessions.sessionId, input.sessionId))
        .limit(1);
      if (!session?.whatsappNumber) return null;
      // Buscar cliente pelo telefone
      const phone = session.whatsappNumber.replace(/\D/g, "");
      const phoneDigits = phone.slice(-11); // ex: "17988112791"
      const phoneLast8 = phone.slice(-8);   // ex: "88112791"
      const { or: orOp } = await import("drizzle-orm");
      const customersList = await db
        .select()
        .from(customers)
        .where(orOp(
          like(customers.phone, `%${phoneDigits}%`),
          like(customers.phone, `%${phoneLast8}%`)
        ))
        .limit(1);
      const customer = customersList[0];
      if (!customer) return null;
      // Buscar último pedido com delivery para pegar nome e endereço mais recentes
      const lastOrders = await db
        .select()
        .from(orders)
        .where(orOp(
          like(orders.customerPhone, `%${phoneDigits}%`),
          like(orders.customerPhone, `%${phoneLast8}%`)
        ))
        .orderBy(desc(orders.createdAt))
        .limit(10); // buscar últimos 10 para encontrar um com endereço
      const lastOrder = lastOrders[0];
      // Último pedido com endereço de delivery (não cancelado preferencialmente)
      const lastDeliveryOrder = lastOrders.find(o => o.deliveryAddress && o.status !== 'cancelled')
        || lastOrders.find(o => o.deliveryAddress); // fallback: qualquer um com endereço

      // Usar nome do último pedido se customer.name for null/vazio
      const resolvedName = customer.name || lastOrder?.customerName || "";
      // Atualizar customer.name no banco se estava vazio e encontramos o nome no pedido
      if (!customer.name && lastOrder?.customerName) {
        await db.update(customers)
          .set({ name: lastOrder.customerName })
          .where(eq(customers.id, customer.id));
      }
      // Endereço: prioridade = customer.address (sempre atualizado pelo createOrder),
      // fallback = último pedido de delivery não cancelado
      const resolvedAddress = customer.address || lastDeliveryOrder?.deliveryAddress || "";
      return {
        name: resolvedName,
        phone: customer.phone || session.whatsappNumber,
        address: resolvedAddress,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        birthDate: customer.birthDate || null,
      };
    }),

  /**
   * Buscar histórico de pedidos do cliente pelo sessionId (para exibir no cardápio digital)
   */
  getOrderHistory: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Buscar sessão para obter o whatsappNumber
      const [session] = await db
        .select()
        .from(orderSessions)
        .where(eq(orderSessions.sessionId, input.sessionId))
        .limit(1);

      if (!session?.whatsappNumber) return [];

      const phone = session.whatsappNumber.replace(/\D/g, "");
      // Usar os últimos 11 dígitos (DDD + número completo) para busca mais precisa
      // Isso garante que tanto "17988112791" quanto "(17) 98811-2791" sejam encontrados
      // pois ambos têm os mesmos dígitos, apenas com formatação diferente
      const phoneDigits = phone.slice(-11); // ex: "17988112791"
      const phoneLast8 = phone.slice(-8);   // ex: "88112791"

      // Buscar últimos 8 pedidos do cliente para filtrar cancelados e mostrar 5 válidos
      // Busca por OR: telefone normalizado (11 dígitos) OU últimos 8 dígitos
      const { or } = await import("drizzle-orm");
      const pastOrders = await db
        .select()
        .from(orders)
        .where(or(
          like(orders.customerPhone, `%${phoneDigits}%`),
          like(orders.customerPhone, `%${phoneLast8}%`)
        ))
        .orderBy(desc(orders.createdAt))
        .limit(8);

      // Filtrar pedidos cancelados e pegar os 5 mais recentes válidos
      const validOrders = pastOrders.filter(o => o.status !== 'cancelled').slice(0, 5);
      // Se não houver pedidos válidos, usar todos (incluindo cancelados)
      const ordersToShow = validOrders.length > 0 ? validOrders : pastOrders.slice(0, 5);

      if (pastOrders.length === 0) return [];

      // Para cada pedido, buscar os itens
      const result = await Promise.all(
        ordersToShow.map(async (order) => {
          const items = await db
            .select({
              id: orderItems.id,
              menuItemId: orderItems.menuItemId,
              quantity: orderItems.quantity,
              unitPrice: orderItems.unitPrice,
              observations: orderItems.observations,
              addons: orderItems.addons,
              itemNameSaved: orderItems.itemName, // nome salvo no momento do pedido
              itemImageUrlSaved: orderItems.itemImageUrl, // imagem salva no momento do pedido
              menuItemName: menuItems.name, // nome atual (pode ser null se item foi deletado)
              menuItemImage: menuItems.imageUrl, // imagem atual (pode ser null se item foi deletado)
            })
            .from(orderItems)
            .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
            .where(eq(orderItems.orderId, order.id));

          return {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            orderType: order.orderType,
            total: order.total,
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            deliveryAddress: order.deliveryAddress,
            paymentMethod: order.paymentMethod,
            createdAt: order.createdAt,
            items: await Promise.all(items.map(async (item) => {
              // Resolver nome e imagem: prioridade = dados atuais do menu > dados salvos no pedido > busca por preço
              let resolvedName = item.menuItemName || item.itemNameSaved;
              let resolvedImage = item.menuItemImage || item.itemImageUrlSaved;

              // Se ainda não tiver nome (pedido antigo sem itemName), tentar buscar pelo preço
              if (!resolvedName && item.unitPrice) {
                const [byPrice] = await db
                  .select({ name: menuItems.name, imageUrl: menuItems.imageUrl })
                  .from(menuItems)
                  .where(eq(menuItems.price, item.unitPrice))
                  .limit(1);
                if (byPrice) {
                  resolvedName = byPrice.name;
                  resolvedImage = resolvedImage || byPrice.imageUrl || null;
                  // Salvar retroativamente no banco para não precisar buscar sempre
                  await db.update(orderItems)
                    .set({ itemName: byPrice.name, itemImageUrl: byPrice.imageUrl || null })
                    .where(eq(orderItems.id, item.id));
                }
              }

              return {
                menuItemId: item.menuItemId,
                name: resolvedName || "Item",
                price: item.unitPrice,
                quantity: item.quantity,
                observations: item.observations || undefined,
                imageUrl: resolvedImage || undefined,
                addons: item.addons ? (() => { try { return JSON.parse(item.addons as string); } catch { return undefined; } })() : undefined,
              };
            })),
          };
        })
      );

      return result;
    }),

  /**
   * Resolver itens do histórico para repetir pedido
   * Busca o menuItemId atual pelo nome quando o ID original não existe mais
   */
  resolveOrderItems: publicProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            menuItemId: z.number(),
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
            observations: z.string().optional(),
            imageUrl: z.string().optional(),
            addons: z.array(z.any()).optional(),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const resolvedItems = await Promise.all(
        input.items.map(async (item) => {
          // Verificar se o menuItemId ainda existe
          const [existingItem] = await db
            .select({ id: menuItems.id, name: menuItems.name, price: menuItems.price, imageUrl: menuItems.imageUrl })
            .from(menuItems)
            .where(eq(menuItems.id, item.menuItemId))
            .limit(1);

          if (existingItem) {
            // Item ainda existe, usar dados atuais
            return {
              ...item,
              menuItemId: existingItem.id,
              name: existingItem.name,
              price: existingItem.price,
              imageUrl: existingItem.imageUrl || item.imageUrl,
              resolved: true,
              notFound: false,
            };
          }

          // Item não existe mais — buscar pelo nome
          const [itemByName] = await db
            .select({ id: menuItems.id, name: menuItems.name, price: menuItems.price, imageUrl: menuItems.imageUrl })
            .from(menuItems)
            .where(eq(menuItems.name, item.name))
            .limit(1);

          if (itemByName) {
            return {
              ...item,
              menuItemId: itemByName.id,
              name: itemByName.name,
              price: itemByName.price,
              imageUrl: itemByName.imageUrl || item.imageUrl,
              resolved: true,
              notFound: false,
            };
          }

          // Item não encontrado nem pelo nome — marcar como não disponível
          return {
            ...item,
            resolved: false,
            notFound: true,
          };
        })
      );

      return resolvedItems;
    }),

  /**
   * Atualizar endereço do cliente (quando ele escolhe novo endereço no checkout)
   */
  updateCustomerAddress: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        address: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      // Buscar a sessão para obter o whatsappNumber
      const [session] = await db
        .select()
        .from(orderSessions)
        .where(eq(orderSessions.sessionId, input.sessionId))
        .limit(1);
      if (!session?.whatsappNumber) return { success: false };
      // Atualizar o endereço do cliente no banco
      await db
        .update(customers)
        .set({ address: input.address })
        .where(eq(customers.whatsappId, session.whatsappNumber));
      return { success: true };
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

      // Salvar horário de confirmação quando restaurante aceita o pedido
      const updateData: Record<string, any> = { status: input.status };
      if (input.status === "confirmed") {
        updateData.confirmedAt = new Date();
      }

      await db
        .update(orders)
        .set(updateData)
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
