import { eq, and, desc, count, sum, avg, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
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
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Restaurant Settings =====

export async function getRestaurantSettings(): Promise<RestaurantSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(restaurantSettings).limit(1);
  return result[0];
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

export async function getCustomerByWhatsappId(whatsappId: string): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Busca direta pelo whatsappId fornecido
  const result = await db.select().from(customers).where(eq(customers.whatsappId, whatsappId)).limit(1);
  if (result[0]) return result[0];

  // Fallback: se o JID for @lid, tentar buscar pelo phone extraído
  // Isso cobre o caso onde o cliente foi cadastrado com @s.whatsapp.net mas agora envia com @lid
  if (whatsappId.endsWith("@lid")) {
    // Buscar por phone parcial não é confiável para @lid (o número é diferente)
    // Retornar undefined para criar novo registro com o JID @lid
    return undefined;
  }

  // Se o JID for @s.whatsapp.net, tentar buscar por phone
  const phone = whatsappId.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  if (phone.length >= 10) {
    const byPhone = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    return byPhone[0];
  }

  return undefined;
}

export async function createCustomer(customer: InsertCustomer): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(customers).values(customer);
  const inserted = await db.select().from(customers).where(eq(customers.id, Number(result[0].insertId))).limit(1);
  return inserted[0]!;
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

  const result: AddonGroupWithOptions[] = [];
  for (const group of groups) {
    const options = await db
      .select()
      .from(menuAddonOptions)
      .where(and(eq(menuAddonOptions.groupId, group.id), eq(menuAddonOptions.isActive, true)))
      .orderBy(menuAddonOptions.displayOrder);
    result.push({ ...group, options });
  }
  return result;
}

export async function getAddonGroupsForItems(menuItemIds: number[]): Promise<Record<number, AddonGroupWithOptions[]>> {
  if (menuItemIds.length === 0) return {};
  const result: Record<number, AddonGroupWithOptions[]> = {};
  for (const id of menuItemIds) {
    result[id] = await getAddonGroupsWithOptions(id);
  }
  return result;
}

export async function createAddonGroup(data: InsertMenuAddonGroup): Promise<MenuAddonGroup> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const res = await db.insert(menuAddonGroups).values(data);
  const inserted = await db.select().from(menuAddonGroups).where(eq(menuAddonGroups.id, Number(res[0].insertId))).limit(1);
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

  const res = await db.insert(menuAddonOptions).values(data);
  const inserted = await db.select().from(menuAddonOptions).where(eq(menuAddonOptions.id, Number(res[0].insertId))).limit(1);
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
