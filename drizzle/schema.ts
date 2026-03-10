import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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

export type RestaurantSettings = typeof restaurantSettings.$inferSelect;
export type InsertRestaurantSettings = typeof restaurantSettings.$inferInsert;

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

export type WhatsappSettings = typeof whatsappSettings.$inferSelect;
export type InsertWhatsappSettings = typeof whatsappSettings.$inferInsert;

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

export type MenuCategory = typeof menuCategories.$inferSelect;
export type InsertMenuCategory = typeof menuCategories.$inferInsert;

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
  isFeatured: boolean("isFeatured").default(false).notNull(), // destaque na seção Mais Pedidos
  preparationTime: int("preparationTime").default(30).notNull(), // em minutos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

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

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Pedidos
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }), // Link para orderSession (pedidos via web)
  customerId: int("customerId"), // Opcional (pode ser pedido via web sem cadastro)
  orderNumber: varchar("orderNumber", { length: 20 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "ready", "delivering", "delivered", "cancelled"]).default("pending").notNull(),
  orderType: mysqlEnum("orderType", ["delivery", "pickup"]).notNull(),
  
  // Dados do cliente (para pedidos via web)
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  
  items: text("items").notNull(), // JSON array de itens (manter para compatibilidade)
  subtotal: int("subtotal").notNull(), // em centavos
  deliveryFee: int("deliveryFee").default(0).notNull(),
  total: int("total").notNull(),
  deliveryAddress: text("deliveryAddress"),
  customerNotes: text("customerNotes"),
  estimatedTime: int("estimatedTime"), // em minutos
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  changeFor: int("changeFor"), // em centavos - valor para troco quando pagamento em dinheiro
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

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
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  customerNotes: text("customerNotes"),
  source: mysqlEnum("source", ["chatbot", "manual", "phone"]).default("chatbot").notNull(),
  reminderSent: boolean("reminderSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = typeof reservations.$inferInsert;

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

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

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

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

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

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

/**
 * Sessões de teste públicas (para URL compartilhável)
 */
export const testSessions = mysqlTable("test_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull().unique(),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().onUpdateNow().notNull(),
});

export type TestSession = typeof testSessions.$inferSelect;
export type InsertTestSession = typeof testSessions.$inferInsert;

/**
 * Mensagens das sessões de teste
 */
export const testMessages = mysqlTable("test_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "audio"]).default("text").notNull(),
  audioUrl: text("audioUrl"), // URL do áudio no S3 (se for áudio)
  transcription: text("transcription"), // Transcrição do áudio (se for áudio)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TestMessage = typeof testMessages.$inferSelect;
export type InsertTestMessage = typeof testMessages.$inferInsert;

/**
 * Sessões de pedido (links únicos para cardápio web)
 */
export const orderSessions = mysqlTable("order_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull().unique(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  customerId: int("customerId"),
  status: mysqlEnum("status", ["pending", "completed", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderSession = typeof orderSessions.$inferSelect;
export type InsertOrderSession = typeof orderSessions.$inferInsert;

/**
 * Itens do pedido (normalizado, não JSON)
 */
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  menuItemId: int("menuItemId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos (preço no momento do pedido)
  observations: text("observations"),
  addons: text("addons"), // JSON array de adicionais
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Fila de mensagens do bot (para notificações WhatsApp)
 */
export const botMessages = mysqlTable("bot_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  message: text("message").notNull(),
  messageType: varchar("messageType", { length: 50 }).notNull(), // order_confirmation, order_update, etc
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BotMessage = typeof botMessages.$inferSelect;
export type InsertBotMessage = typeof botMessages.$inferInsert;

/**
 * Grupos de complementos/adicionais por item do cardápio
 * Ex: "Escolha as carnes", "Ponto da carne", "Molho para o churrasco?", "Precisa de talheres?"
 */
export const menuAddonGroups = mysqlTable("menu_addon_groups", {
  id: int("id").autoincrement().primaryKey(),
  menuItemId: int("menuItemId").notNull(), // FK para menu_items
  name: varchar("name", { length: 150 }).notNull(), // "Escolha as carnes"
  description: text("description"), // descrição opcional do grupo
  isRequired: boolean("isRequired").default(false).notNull(), // OBRIGATÓRIO ou opcional
  minSelections: int("minSelections").default(0).notNull(), // mínimo de seleções
  maxSelections: int("maxSelections").default(1).notNull(), // máximo de seleções (1 = radio, >1 = checkbox)
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuAddonGroup = typeof menuAddonGroups.$inferSelect;
export type InsertMenuAddonGroup = typeof menuAddonGroups.$inferInsert;

/**
 * Opções dentro de cada grupo de complementos
 * Ex: "Com cupim", "Com costela no bafo", "Molho chimichurri (+R$3,99)", "Com talher (+R$0,50)"
 */
export const menuAddonOptions = mysqlTable("menu_addon_options", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(), // FK para menu_addon_groups
  name: varchar("name", { length: 150 }).notNull(), // "Com cupim"
  description: text("description"), // "Delicioso cupim cozido por mais de 6 horas..."
  priceExtra: int("priceExtra").default(0).notNull(), // preço adicional em centavos (0 = grátis)
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuAddonOption = typeof menuAddonOptions.$inferSelect;
export type InsertMenuAddonOption = typeof menuAddonOptions.$inferInsert;
