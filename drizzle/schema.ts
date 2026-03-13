import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

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
  categoryId: int("categoryId").notNull().references(() => menuCategories.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: int("price").notNull(), // em centavos
  imageUrl: text("imageUrl"),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  isFeatured: boolean("isFeatured").default(false).notNull(), // destaque na seção Mais Pedidos
  preparationTime: int("preparationTime").default(30).notNull(), // em minutos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_menu_items_category").on(t.categoryId),
  index("idx_menu_items_available").on(t.isAvailable),
]);

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

/**
 * Clientes do WhatsApp
 * Soft delete: deletedAt preenchido = cliente excluído (LGPD direito ao esquecimento)
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  whatsappId: varchar("whatsappId", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  address: text("address"),
  totalOrders: int("totalOrders").default(0).notNull(),
  totalSpent: int("totalSpent").default(0).notNull(), // em centavos
  birthDate: varchar("birthDate", { length: 10 }), // formato DD/MM/AAAA
  deletedAt: timestamp("deletedAt"), // LGPD: soft delete — null = ativo, preenchido = excluído
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_customers_phone").on(t.phone),
  index("idx_customers_deleted").on(t.deletedAt),
]);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Pedidos
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }), // Link para orderSession (pedidos via web)
  customerId: int("customerId").references(() => customers.id), // FK explícita
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
  confirmedAt: timestamp("confirmedAt"), // horário em que o restaurante confirmou o pedido
  printedAt: timestamp("printedAt"), // horário em que a comanda foi impressa
  printToken: varchar("printToken", { length: 64 }), // token aleatório para acesso à comanda
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_orders_status").on(t.status),
  index("idx_orders_customer_phone").on(t.customerPhone),
  index("idx_orders_created_at").on(t.createdAt),
  index("idx_orders_session").on(t.sessionId),
  index("idx_orders_print_token").on(t.printToken),
]);

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Reservas
 */
export const reservations = mysqlTable("reservations", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").references(() => customers.id), // FK explícita
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
}, (t) => [
  index("idx_reservations_status").on(t.status),
  index("idx_reservations_date").on(t.date),
  index("idx_reservations_phone").on(t.customerPhone),
  index("idx_reservations_reminder").on(t.reminderSent, t.date),
]);

export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = typeof reservations.$inferInsert;

/**
 * Conversas/Sessões do WhatsApp
 * Soft delete: deletedAt preenchido = conversa excluída (LGPD)
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customers.id), // FK explícita
  whatsappMessageId: varchar("whatsappMessageId", { length: 255 }),
  intent: mysqlEnum("intent", ["order", "reservation", "info", "feedback", "other"]),
  context: text("context"), // JSON com contexto da conversa
  isActive: boolean("isActive").default(true).notNull(),
  humanMode: boolean("humanMode").default(false).notNull(), // true quando operador assumiu a conversa
  humanModeUntil: timestamp("humanModeUntil"), // bot silencioso até este momento
  deletedAt: timestamp("deletedAt"), // LGPD: soft delete
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_conversations_customer").on(t.customerId),
  index("idx_conversations_active").on(t.isActive),
  index("idx_conversations_deleted").on(t.deletedAt),
]);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Mensagens do histórico
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull().references(() => conversations.id),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "audio", "interactive"]).default("text").notNull(),
  metadata: text("metadata"), // JSON com dados adicionais
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_messages_conversation").on(t.conversationId),
  index("idx_messages_created_at").on(t.createdAt),
]);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Feedback dos clientes
 */
export const feedback = mysqlTable("feedback", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().references(() => customers.id),
  orderId: int("orderId").references(() => orders.id),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_feedback_customer").on(t.customerId),
]);

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
}, (t) => [
  index("idx_test_messages_session").on(t.sessionId),
]);

export type TestMessage = typeof testMessages.$inferSelect;
export type InsertTestMessage = typeof testMessages.$inferInsert;

/**
 * Sessões de pedido (links únicos para cardápio web)
 */
export const orderSessions = mysqlTable("order_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull().unique(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  customerId: int("customerId").references(() => customers.id),
  status: mysqlEnum("status", ["pending", "completed", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_order_sessions_expires").on(t.expiresAt),
  index("idx_order_sessions_status").on(t.status),
]);

export type OrderSession = typeof orderSessions.$inferSelect;
export type InsertOrderSession = typeof orderSessions.$inferInsert;

/**
 * Itens do pedido (normalizado, não JSON)
 */
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  menuItemId: int("menuItemId").notNull().references(() => menuItems.id),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(), // em centavos (preço no momento do pedido)
  itemName: varchar("itemName", { length: 255 }), // nome do item salvo no momento do pedido
  itemImageUrl: text("itemImageUrl"), // imagem do item salva no momento do pedido
  observations: text("observations"),
  addons: text("addons"), // JSON array de adicionais
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_order_items_order").on(t.orderId),
]);

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Fila de mensagens do bot (para notificações WhatsApp)
 * Worker de retry processa status=pending e status=failed com retries < 3
 */
export const botMessages = mysqlTable("bot_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 255 }).notNull(),
  whatsappNumber: varchar("whatsappNumber", { length: 20 }),
  message: text("message").notNull(),
  messageType: varchar("messageType", { length: 50 }).notNull(), // order_confirmation, order_update, etc
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  retries: int("retries").default(0).notNull(), // número de tentativas de envio
  sentAt: timestamp("sentAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_bot_messages_status").on(t.status),
  index("idx_bot_messages_created").on(t.createdAt),
]);

export type BotMessage = typeof botMessages.$inferSelect;
export type InsertBotMessage = typeof botMessages.$inferInsert;

/**
 * Grupos de complementos/adicionais por item do cardápio
 */
export const menuAddonGroups = mysqlTable("menu_addon_groups", {
  id: int("id").autoincrement().primaryKey(),
  menuItemId: int("menuItemId").notNull().references(() => menuItems.id),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  isRequired: boolean("isRequired").default(false).notNull(),
  minSelections: int("minSelections").default(0).notNull(),
  maxSelections: int("maxSelections").default(1).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_addon_groups_item").on(t.menuItemId),
]);

export type MenuAddonGroup = typeof menuAddonGroups.$inferSelect;
export type InsertMenuAddonGroup = typeof menuAddonGroups.$inferInsert;

/**
 * Opções dentro de cada grupo de complementos
 */
export const menuAddonOptions = mysqlTable("menu_addon_options", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull().references(() => menuAddonGroups.id),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  priceExtra: int("priceExtra").default(0).notNull(), // preço adicional em centavos (0 = grátis)
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_addon_options_group").on(t.groupId),
]);

export type MenuAddonOption = typeof menuAddonOptions.$inferSelect;
export type InsertMenuAddonOption = typeof menuAddonOptions.$inferInsert;


/**
 * Audit logs — registro de ações administrativas para rastreabilidade
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // admin que fez a ação (null = sistema)
  action: varchar("action", { length: 100 }).notNull(), // ex: "order.confirm", "reservation.cancel", "menu.update"
  entityType: varchar("entityType", { length: 50 }).notNull(), // ex: "order", "reservation", "menuItem"
  entityId: int("entityId"), // ID da entidade afetada
  details: text("details"), // JSON com detalhes da ação
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_audit_action").on(t.action),
  index("idx_audit_entity").on(t.entityType, t.entityId),
  index("idx_audit_created").on(t.createdAt),
]);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;


/**
 * Mensagens processadas — deduplicação distribuída entre múltiplas instâncias do servidor.
 * Quando webhook + polling + múltiplos servidores (dev/prod) processam a mesma mensagem,
 * esta tabela garante que apenas a primeira instância a inserir o messageId irá processá-la.
 * Usa INSERT IGNORE com chave única no messageId.
 */
export const processedMessages = mysqlTable("processed_messages", {
  id: int("id").autoincrement().primaryKey(),
  messageId: varchar("messageId", { length: 128 }).notNull().unique(),
  source: varchar("source", { length: 20 }).notNull(), // "webhook" | "polling"
  processedAt: timestamp("processedAt").defaultNow().notNull(),
}, (t) => [
  index("idx_processed_at").on(t.processedAt),
]);
export type ProcessedMessage = typeof processedMessages.$inferSelect;
