import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
/**
 * Configurações do restaurante
 */
export const restaurantSettings = mysqlTable("restaurant_settings", {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    address: text("address").notNull(),
    openingHours: text("openingHours").notNull(), // JSON string com horários
    acceptsDelivery: boolean("acceptsDelivery").default(true).notNull(),
    acceptsReservation: boolean("acceptsReservation").default(true).notNull(),
    deliveryFee: int("deliveryFee").default(0).notNull(), // em centavos
    minimumOrder: int("minimumOrder").default(0).notNull(), // em centavos
    paymentMethods: text("paymentMethods").notNull(), // JSON array
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Configurações do WhatsApp Business API
 */
export const whatsappSettings = mysqlTable("whatsapp_settings", {
    id: int("id").autoincrement().primaryKey(),
    phoneNumberId: varchar("phoneNumberId", { length: 255 }).notNull(),
    accessToken: text("accessToken").notNull(),
    webhookVerifyToken: varchar("webhookVerifyToken", { length: 255 }).notNull(),
    businessAccountId: varchar("businessAccountId", { length: 255 }),
    isActive: boolean("isActive").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Categorias do cardápio
 */
export const menuCategories = mysqlTable("menu_categories", {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    displayOrder: int("displayOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Itens do cardápio
 */
export const menuItems = mysqlTable("menu_items", {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: int("price").notNull(), // em centavos
    imageUrl: text("imageUrl"),
    isAvailable: boolean("isAvailable").default(true).notNull(),
    preparationTime: int("preparationTime").default(30).notNull(), // em minutos
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Clientes do WhatsApp
 */
export const customers = mysqlTable("customers", {
    id: int("id").autoincrement().primaryKey(),
    whatsappId: varchar("whatsappId", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    phone: varchar("phone", { length: 20 }).notNull(),
    address: text("address"),
    totalOrders: int("totalOrders").default(0).notNull(),
    totalSpent: int("totalSpent").default(0).notNull(), // em centavos
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Pedidos
 */
export const orders = mysqlTable("orders", {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    orderNumber: varchar("orderNumber", { length: 20 }).notNull().unique(),
    status: mysqlEnum("status", ["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]).default("pending").notNull(),
    orderType: mysqlEnum("orderType", ["delivery", "pickup"]).notNull(),
    items: text("items").notNull(), // JSON array de itens
    subtotal: int("subtotal").notNull(), // em centavos
    deliveryFee: int("deliveryFee").default(0).notNull(),
    total: int("total").notNull(),
    deliveryAddress: text("deliveryAddress"),
    customerNotes: text("customerNotes"),
    estimatedTime: int("estimatedTime"), // em minutos
    paymentMethod: varchar("paymentMethod", { length: 50 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Reservas
 */
export const reservations = mysqlTable("reservations", {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    reservationNumber: varchar("reservationNumber", { length: 20 }).notNull().unique(),
    status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"]).default("pending").notNull(),
    date: timestamp("date").notNull(),
    numberOfPeople: int("numberOfPeople").notNull(),
    customerNotes: text("customerNotes"),
    reminderSent: boolean("reminderSent").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Conversas/Sessões do WhatsApp
 */
export const conversations = mysqlTable("conversations", {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    whatsappMessageId: varchar("whatsappMessageId", { length: 255 }),
    intent: mysqlEnum("intent", ["order", "reservation", "info", "feedback", "other"]),
    context: text("context"), // JSON com contexto da conversa
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Mensagens do histórico
 */
export const messages = mysqlTable("messages", {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    messageType: mysqlEnum("messageType", ["text", "image", "audio", "interactive"]).default("text").notNull(),
    metadata: text("metadata"), // JSON com dados adicionais
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
/**
 * Feedback dos clientes
 */
export const feedback = mysqlTable("feedback", {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    orderId: int("orderId"),
    rating: int("rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
});
