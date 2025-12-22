CREATE TABLE `bot_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(255) NOT NULL,
	`whatsappNumber` varchar(20),
	`message` text NOT NULL,
	`messageType` varchar(50) NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bot_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`menuItemId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`observations` text,
	`addons` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(255) NOT NULL,
	`whatsappNumber` varchar(20),
	`customerId` int,
	`status` enum('pending','completed','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `customerId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `sessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `customerName` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customerPhone` varchar(20) NOT NULL;