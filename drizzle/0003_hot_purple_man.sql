ALTER TABLE `reservations` ADD `customerName` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `customerPhone` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `source` enum('chatbot','manual','phone') DEFAULT 'chatbot' NOT NULL;