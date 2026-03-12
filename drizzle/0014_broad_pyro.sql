ALTER TABLE `bot_messages` ADD `retries` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `customers` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_addon_groups` ADD CONSTRAINT `menu_addon_groups_menuItemId_menu_items_id_fk` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_addon_options` ADD CONSTRAINT `menu_addon_options_groupId_menu_addon_groups_id_fk` FOREIGN KEY (`groupId`) REFERENCES `menu_addon_groups`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_categoryId_menu_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `menu_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_menuItemId_menu_items_id_fk` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_sessions` ADD CONSTRAINT `order_sessions_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_bot_messages_status` ON `bot_messages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bot_messages_created` ON `bot_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_conversations_customer` ON `conversations` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_conversations_active` ON `conversations` (`isActive`);--> statement-breakpoint
CREATE INDEX `idx_conversations_deleted` ON `conversations` (`deletedAt`);--> statement-breakpoint
CREATE INDEX `idx_customers_phone` ON `customers` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_customers_deleted` ON `customers` (`deletedAt`);--> statement-breakpoint
CREATE INDEX `idx_feedback_customer` ON `feedback` (`customerId`);--> statement-breakpoint
CREATE INDEX `idx_addon_groups_item` ON `menu_addon_groups` (`menuItemId`);--> statement-breakpoint
CREATE INDEX `idx_addon_options_group` ON `menu_addon_options` (`groupId`);--> statement-breakpoint
CREATE INDEX `idx_menu_items_category` ON `menu_items` (`categoryId`);--> statement-breakpoint
CREATE INDEX `idx_menu_items_available` ON `menu_items` (`isAvailable`);--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `idx_messages_created_at` ON `messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `idx_order_sessions_expires` ON `order_sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_order_sessions_status` ON `order_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_customer_phone` ON `orders` (`customerPhone`);--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_orders_session` ON `orders` (`sessionId`);--> statement-breakpoint
CREATE INDEX `idx_orders_print_token` ON `orders` (`printToken`);--> statement-breakpoint
CREATE INDEX `idx_reservations_status` ON `reservations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reservations_date` ON `reservations` (`date`);--> statement-breakpoint
CREATE INDEX `idx_reservations_phone` ON `reservations` (`customerPhone`);--> statement-breakpoint
CREATE INDEX `idx_reservations_reminder` ON `reservations` (`reminderSent`,`date`);--> statement-breakpoint
CREATE INDEX `idx_test_messages_session` ON `test_messages` (`sessionId`);