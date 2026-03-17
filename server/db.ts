import { eq, and, desc, count, sum, avg, sql, or, like, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser,
  users,
  restaurantSettings,
  whatsappSettings,
  menuCategories,
  menuItems,
  menuAddonGroups,
  menuAddonOptions,
  customers,
  orders,
  reservations,
  conversations,
  messages,
  feedback,
  type RestaurantSettings,
  type WhatsappSettings,
  type MenuCategory,
  type MenuItem,
  type MenuAddonGroup,
  type MenuAddonOption,
  type InsertMenuAddonGroup,
  type InsertMenuAddonOption,
  type Customer,
  type Order,
  type Reservation,
  type Conversation,
  type Message,
  type InsertCustomer,
  type InsertOrder,
  type InsertReservation,
  type InsertConversation,
  type InsertMessage,
  type InsertFeedback,
  type InsertRestaurantSettings,
  type InsertWhatsappSettings,
  type InsertMenuCategory,
  type InsertMenuItem,
  processedMessages,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { cached, invalidateCache } from "./cache";
import { logger } from "./utils/logger";

let _db: ReturnType<typeof drizzle> | null = null;
let _lastInitAttemptMs = 0;
const DB_INIT_RETRY_INTERVAL_MS = 10_000;

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;

  const now = Date.now();
  if (now - _lastInitAttemptMs < DB_INIT_RETRY_INTERVAL_MS) {
    return null; // circuit breaker: não tentar inicialização mais de 1x a cada 10s
  }
  _lastInitAttemptMs = now;

  try {
    const pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 10,
      connectTimeout: 10_000,
    });
    _db = drizzle(pool as any);
    return _db;
  } catch (error) {
    logger.error("Database", "Failed to initialize connection pool", error);
    return null;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("Database", "Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    logger.error("Database", "Failed to upsert user", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("Database", "Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Restaurant Settings =====

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function getRestaurantSettings(): Promise<RestaurantSettings | undefined> {
  return cached(
    "restaurant_settings",
    async () => {
      const db = await getDb();
      if (!db) return undefined;
      const result = await db.select().from(restaurantSettings).limit(1);
      return result[0];
    },
    SETTINGS_CACHE_TTL_MS
  );
}

export async function upsertRestaurantSettings(settings: InsertRestaurantSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getRestaurantSettings();

  if (existing) {
    await db.update(restaurantSettings).set(settings).where(eq(restaurantSettings.id, existing.id));
  } else {
    await db.insert(restaurantSettings).values(settings);
  }
  // Invalidar cache após atualização
  invalidateCache("restaurant_settings");
}

// ===== WhatsApp Settings =====

export async function getWhatsappSettings(): Promise<WhatsappSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(whatsappSettings).limit(1);
  return result[0];
}

export async function upsertWhatsappSettings(settings: InsertWhatsappSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getWhatsappSettings();
  
  if (existing) {
    await db.update(whatsappSettings).set(settings).where(eq(whatsappSettings.id, existing.id));
  } else {
    await db.insert(whatsappSettings).values(settings);
  }
}

// ===== Menu Categories =====

export async function getMenuCategories(): Promise<MenuCategory[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(menuCategories).where(eq(menuCategories.isActive, true)).orderBy(menuCategories.displayOrder);
}

export async function createMenuCategory(category: InsertMenuCategory): Promise<MenuCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(menuCategories).values(category);
  const inserted = await db.select().from(menuCategories).where(eq(menuCategories.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function updateMenuCategory(id: number, category: Partial<InsertMenuCategory>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(menuCategories).set(category).where(eq(menuCategories.id, id));
}

export async function deleteMenuCategory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(menuCategories).set({ isActive: false }).where(eq(menuCategories.id, id));
}

// ===== Menu Items =====

export async function getMenuItems(categoryId?: number): Promise<MenuItem[]> {
  const db = await getDb();
  if (!db) return [];

  if (categoryId) {
    return await db.select().from(menuItems).where(and(eq(menuItems.categoryId, categoryId), eq(menuItems.isAvailable, true)));
  }
  return await db.select().from(menuItems).where(eq(menuItems.isAvailable, true));
}

export async function getFeaturedMenuItems(): Promise<MenuItem[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.isAvailable, true), eq(menuItems.isFeatured, true)))
    .limit(10);
}

export async function getMenuItemById(id: number): Promise<MenuItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return result[0];
}

export async function createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(menuItems).values(item);
  const inserted = await db.select().from(menuItems).where(eq(menuItems.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(menuItems).set(item).where(eq(menuItems.id, id));
}

export async function deleteMenuItem(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(menuItems).set({ isAvailable: false }).where(eq(menuItems.id, id));
}

// ===== Customers =====

/**
 * Busca um cliente pelo whatsappId, com fallback inteligente.
 * 
 * Estratégia de busca (em ordem):
 * 1. Busca exata pelo whatsappId fornecido
 * 2. Se o JID for @s.whatsapp.net, busca também pelo phone (sem sufixo)
 * 3. Se o JID for @lid, busca pelo phone usando os últimos 8-11 dígitos
 *    (o número LID é diferente do número real, então não dá para fazer match direto)
 * 4. Busca por qualquer registro com phone parcial (últimos 8 dígitos)
 * 
 * NOTA: Quando o caller tem o número real (via remoteJidAlt), deve passar como realPhone
 * para permitir busca precisa mesmo com JID @lid.
 */
export async function getCustomerByWhatsappId(
  whatsappId: string,
  realPhone?: string
): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // 1. Busca direta pelo whatsappId fornecido
  const result = await db.select().from(customers).where(eq(customers.whatsappId, whatsappId)).limit(1);
  if (result[0]) return result[0];

  // 2. Se temos o número real (via remoteJidAlt), buscar por ele
  if (realPhone) {
    const digits = realPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
      // Buscar por whatsappId com @s.whatsapp.net
      const byJid = await db.select().from(customers)
        .where(eq(customers.whatsappId, `${digits}@s.whatsapp.net`))
        .limit(1);
      if (byJid[0]) return byJid[0];

      // Buscar por whatsappId sem sufixo
      const byPlain = await db.select().from(customers)
        .where(eq(customers.whatsappId, digits))
        .limit(1);
      if (byPlain[0]) return byPlain[0];

      // Buscar por phone exato
      const byPhone = await db.select().from(customers)
        .where(eq(customers.phone, digits))
        .limit(1);
      if (byPhone[0]) return byPhone[0];

      // Buscar por phone parcial (últimos 11 dígitos)
      const phoneDigits = digits.slice(-11);
      const byPhonePartial = await db.select().from(customers)
        .where(like(customers.phone, `%${phoneDigits}%`))
        .limit(1);
      if (byPhonePartial[0]) return byPhonePartial[0];
    }
  }

  // 3. Se o JID for @s.whatsapp.net, tentar buscar por phone
  if (whatsappId.endsWith("@s.whatsapp.net")) {
    const phone = whatsappId.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    if (phone.length >= 10) {
      // Buscar por whatsappId sem sufixo
      const byPlain = await db.select().from(customers)
        .where(eq(customers.whatsappId, phone))
        .limit(1);
      if (byPlain[0]) return byPlain[0];

      // Buscar por phone
      const byPhone = await db.select().from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);
      if (byPhone[0]) return byPhone[0];
    }
  }

  // 4. Se o JID for @lid e NÃO temos realPhone, não podemos fazer match confiável
  // Retornar undefined para criar novo registro
  return undefined;
}

export async function createCustomer(customer: InsertCustomer): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(customers).values(customer);
  const inserted = await db.select().from(customers).where(eq(customers.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

/**
 * Cria um cliente e sua conversa inicial em uma única transação atômica.
 * Garante que nunca exista um cliente sem conversa ativa após a criação.
 *
 * DB-2: substitui o padrão de dois inserts independentes que poderiam
 * deixar um cliente órfão se `createConversation` falhasse.
 */
export async function createCustomerWithConversation(
  customerData: InsertCustomer,
  conversationData: Omit<InsertConversation, "customerId">
): Promise<{ customer: Customer; conversation: Conversation }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    const customerResult = await tx.insert(customers).values(customerData);
    const customerId = Number(customerResult[0].insertId);

    const convResult = await tx.insert(conversations).values({
      ...conversationData,
      customerId,
    });
    const convId = Number(convResult[0].insertId);

    const [customer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    const [conversation] = await tx
      .select()
      .from(conversations)
      .where(eq(conversations.id, convId))
      .limit(1);

    return { customer: customer!, conversation: conversation! };
  });
}

export async function updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(customers).set(customer).where(eq(customers.id, id));
}

export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(customers).orderBy(desc(customers.createdAt));
}

// ===== Orders =====

export async function createOrder(order: InsertOrder): Promise<Order> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(orders).values(order);
  const inserted = await db.select().from(orders).where(eq(orders.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function getOrderById(id: number): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getOrdersByCustomer(customerId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
}

export async function getAllOrders(): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(id: number, status: Order["status"]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

// ===== Reservations =====

export async function createReservation(reservation: InsertReservation): Promise<Reservation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reservations).values(reservation);
  const inserted = await db.select().from(reservations).where(eq(reservations.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function getReservationById(id: number): Promise<Reservation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
  return result[0];
}

export async function getReservationsByCustomer(customerId: number): Promise<Reservation[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(reservations).where(eq(reservations.customerId, customerId)).orderBy(desc(reservations.date));
}

export async function getAllReservations(): Promise<Reservation[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(reservations).orderBy(desc(reservations.date));
}

export async function updateReservationStatus(id: number, status: Reservation["status"]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(reservations).set({ status }).where(eq(reservations.id, id));
}

// ===== Conversations =====

export async function getActiveConversation(customerId: number): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.customerId, customerId), eq(conversations.isActive, true)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  
  return result[0];
}

/**
 * Busca conversa ativa diretamente pelo whatsappId do cliente (sem precisar do customerId).
 * Usado na verificação antecipada do modo humano, antes de carregar o cliente completo.
 */
export async function getActiveConversationByWhatsappId(
  whatsappId: string,
  realPhone?: string
): Promise<Conversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Buscar o cliente primeiro (reutiliza a lógica de busca flexível)
  const customer = await getCustomerByWhatsappId(whatsappId, realPhone);
  if (!customer) return undefined;

  // Buscar conversa ativa do cliente
  return getActiveConversation(customer.id);
}

export async function createConversation(conversation: InsertConversation): Promise<Conversation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(conversations).values(conversation);
  const inserted = await db.select().from(conversations).where(eq(conversations.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function updateConversation(id: number, conversation: Partial<InsertConversation>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(conversations).set(conversation).where(eq(conversations.id, id));
}

export async function closeConversation(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(conversations).set({ isActive: false }).where(eq(conversations.id, id));
}

// ===== Messages =====

export async function createMessage(message: InsertMessage): Promise<Message> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(messages).values(message);
  const inserted = await db.select().from(messages).where(eq(messages.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function getMessagesByConversation(conversationId: number): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

// ===== Feedback =====

export async function createFeedback(feedbackData: InsertFeedback): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(feedback).values(feedbackData);
}

export async function getAllFeedback(): Promise<typeof feedback.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(feedback).orderBy(desc(feedback.createdAt));
}

/**
 * Dashboard stats otimizado — usa COUNT/SUM/AVG no SQL em vez de carregar tudo na memória
 * Reduz transferência de dados e tempo de resposta significativamente
 */
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return {
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    activeReservations: 0,
    totalCustomers: 0,
    averageRating: 0,
  };

  // Executar todas as queries em paralelo para máxima performance
  const [orderStats, pendingStats, reservationStats, customerStats, ratingStats] = await Promise.all([
    // Total de pedidos e receita total
    db.select({
      totalOrders: count(),
      totalRevenue: sum(orders.total),
    }).from(orders),
    // Pedidos pendentes
    db.select({
      pendingOrders: count(),
    }).from(orders).where(eq(orders.status, "pending")),
    // Reservas ativas (confirmadas)
    db.select({
      activeReservations: count(),
    }).from(reservations).where(eq(reservations.status, "confirmed")),
    // Total de clientes
    db.select({
      totalCustomers: count(),
    }).from(customers),
    // Média de avaliação
    db.select({
      averageRating: avg(feedback.rating),
    }).from(feedback),
  ]);

  return {
    totalOrders: orderStats[0]?.totalOrders ?? 0,
    totalRevenue: Number(orderStats[0]?.totalRevenue ?? 0),
    pendingOrders: pendingStats[0]?.pendingOrders ?? 0,
    activeReservations: reservationStats[0]?.activeReservations ?? 0,
    totalCustomers: customerStats[0]?.totalCustomers ?? 0,
    averageRating: Number(ratingStats[0]?.averageRating ?? 0),
  };
}

// ===== Complementos do Cardápio (Addon Groups & Options) =====

export type AddonGroupWithOptions = MenuAddonGroup & {
  options: MenuAddonOption[];
};

export async function getAddonGroupsWithOptions(menuItemId: number): Promise<AddonGroupWithOptions[]> {
  const db = await getDb();
  if (!db) return [];

  const groups = await db
    .select()
    .from(menuAddonGroups)
    .where(and(eq(menuAddonGroups.menuItemId, menuItemId), eq(menuAddonGroups.isActive, true)))
    .orderBy(menuAddonGroups.displayOrder);

  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);
  const options = await db
    .select()
    .from(menuAddonOptions)
    .where(and(inArray(menuAddonOptions.groupId, groupIds), eq(menuAddonOptions.isActive, true)))
    .orderBy(menuAddonOptions.displayOrder);

  const optionsByGroup = options.reduce<Record<number, MenuAddonOption[]>>((acc, opt) => {
    if (!acc[opt.groupId]) acc[opt.groupId] = [];
    acc[opt.groupId]!.push(opt);
    return acc;
  }, {});

  return groups.map((group) => ({ ...group, options: optionsByGroup[group.id] ?? [] }));
}

export async function getAddonGroupsForItems(menuItemIds: number[]): Promise<Record<number, AddonGroupWithOptions[]>> {
  if (menuItemIds.length === 0) return {};

  const db = await getDb();
  if (!db) return {};

  // Busca batch: todos os grupos ativos para os itens solicitados de uma vez
  const groups = await db
    .select()
    .from(menuAddonGroups)
    .where(and(inArray(menuAddonGroups.menuItemId, menuItemIds), eq(menuAddonGroups.isActive, true)))
    .orderBy(menuAddonGroups.displayOrder);

  if (groups.length === 0) {
    return menuItemIds.reduce<Record<number, AddonGroupWithOptions[]>>((acc, id) => {
      acc[id] = [];
      return acc;
    }, {});
  }

  const groupIds = groups.map((g) => g.id);

  // Busca batch: todas as opções ativas para os grupos encontrados
  const options = await db
    .select()
    .from(menuAddonOptions)
    .where(and(inArray(menuAddonOptions.groupId, groupIds), eq(menuAddonOptions.isActive, true)))
    .orderBy(menuAddonOptions.displayOrder);

  // Agrupar opções por groupId em memória
  const optionsByGroup = options.reduce<Record<number, MenuAddonOption[]>>((acc, opt) => {
    if (!acc[opt.groupId]) acc[opt.groupId] = [];
    acc[opt.groupId]!.push(opt);
    return acc;
  }, {});

  // Agrupar grupos por menuItemId em memória
  const result: Record<number, AddonGroupWithOptions[]> = {};
  for (const id of menuItemIds) {
    result[id] = [];
  }
  for (const group of groups) {
    result[group.menuItemId]!.push({ ...group, options: optionsByGroup[group.id] ?? [] });
  }

  return result;
}

export async function createAddonGroup(data: InsertMenuAddonGroup): Promise<MenuAddonGroup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const insertResult = await db.insert(menuAddonGroups).values(data);
  const inserted = await db.select().from(menuAddonGroups).where(eq(menuAddonGroups.id, Number(insertResult[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function updateAddonGroup(id: number, data: Partial<InsertMenuAddonGroup>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(menuAddonGroups).set(data).where(eq(menuAddonGroups.id, id));
}

export async function deleteAddonGroup(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Deleta opções primeiro, depois o grupo
  await db.delete(menuAddonOptions).where(eq(menuAddonOptions.groupId, id));
  await db.delete(menuAddonGroups).where(eq(menuAddonGroups.id, id));
}

export async function createAddonOption(data: InsertMenuAddonOption): Promise<MenuAddonOption> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const insertResult = await db.insert(menuAddonOptions).values(data);
  const inserted = await db.select().from(menuAddonOptions).where(eq(menuAddonOptions.id, Number(insertResult[0].insertId))).limit(1);
  return inserted[0]!;
}

export async function updateAddonOption(id: number, data: Partial<InsertMenuAddonOption>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(menuAddonOptions).set(data).where(eq(menuAddonOptions.id, id));
}

export async function deleteAddonOption(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(menuAddonOptions).where(eq(menuAddonOptions.id, id));
}


/**
 * Deduplicação distribuída de mensagens via banco de dados.
 * Garante que apenas UMA instância do servidor (dev, produção, webhook, polling)
 * processe cada mensagem, mesmo com múltiplos servidores rodando simultaneamente.
 * 
 * Usa INSERT IGNORE: se o messageId já existe (unique constraint), retorna false.
 * Se inseriu com sucesso, retorna true (esta instância deve processar).
 * 
 * @returns true se esta instância deve processar a mensagem (primeira a inserir)
 */
export async function tryClaimMessage(messageId: string, source: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    // Se o banco não está disponível, permitir processamento (fallback)
    logger.warn("Dedup", "Banco não disponível, permitindo processamento");
    return true;
  }

  try {
    const { sql } = await import("drizzle-orm");
    // INSERT IGNORE: se o messageId já existe (unique constraint), não insere e retorna affectedRows=0
    const res = await db.execute(sql`INSERT IGNORE INTO processed_messages (messageId, source) VALUES (${messageId}, ${source})`);
    
    // affectedRows > 0 = inseriu com sucesso = esta instância deve processar
    const affectedRows = (res as any)?.[0]?.affectedRows ?? (res as any)?.affectedRows ?? 0;
    if (affectedRows > 0) {
      return true; // Primeira instância a reclamar
    }
    return false; // Outra instância já processou
  } catch (error: any) {
    // Se for erro de duplicate key, outra instância já processou
    if (error?.cause?.code === "ER_DUP_ENTRY" || error?.code === "ER_DUP_ENTRY") {
      return false;
    }
    // Outro erro: logar para alertar sobre instabilidade, mas permitir processamento (fail-open)
    logger.error("Dedup", `Erro inesperado ao verificar messageId ${messageId}`, error);
    return true;
  }
}

/**
 * Limpa mensagens processadas antigas (mais de 1 hora).
 * Deve ser chamada periodicamente para evitar crescimento infinito da tabela.
 */
export async function cleanupProcessedMessages(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`DELETE FROM processed_messages WHERE processedAt < DATE_SUB(NOW(), INTERVAL 1 HOUR)`);
  } catch (error) {
    logger.error("Dedup", "Erro ao limpar mensagens antigas", error);
  }
}


// ===== Contexto do Cliente para Chatbot =====

/**
 * Busca pedidos recentes do cliente (últimas 24h) para incluir no contexto do chatbot.
 * Isso permite que o bot saiba que o cliente tem pedidos ativos sem precisar perguntar o número.
 */
export async function getRecentOrdersByCustomer(customerId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await db.select().from(orders)
    .where(and(
      eq(orders.customerId, customerId),
      gte(orders.createdAt, oneDayAgo)
    ))
    .orderBy(desc(orders.createdAt))
    .limit(5);
}

/**
 * Busca reservas ativas/pendentes do cliente para incluir no contexto do chatbot.
 * Isso permite que o bot saiba sobre reservas existentes sem perder o contexto.
 */
export async function getActiveReservationsByCustomer(customerId: number): Promise<Reservation[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(reservations)
    .where(and(
      eq(reservations.customerId, customerId),
      or(
        eq(reservations.status, "pending"),
        eq(reservations.status, "confirmed")
      )
    ))
    .orderBy(desc(reservations.date))
    .limit(5);
}

/**
 * Busca as últimas N mensagens da conversa para fornecer contexto mais amplo ao LLM.
 */
export async function getConversationMessages(conversationId: number, limit: number = 30): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}


// ===== Human Mode Conversations =====

/**
 * Lista conversas ativas que estão em modo humano (operador atendendo).
 * Retorna informações do cliente junto com a conversa.
 */
export async function getHumanModeConversations(): Promise<
  Array<{
    conversationId: number;
    customerId: number;
    customerName: string | null;
    customerPhone: string;
    humanModeUntil: Date | null;
    updatedAt: Date;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      conversationId: conversations.id,
      customerId: conversations.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      humanModeUntil: conversations.humanModeUntil,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(
      and(
        eq(conversations.isActive, true),
        eq(conversations.humanMode, true)
      )
    )
    .orderBy(desc(conversations.updatedAt));

  return result;
}
