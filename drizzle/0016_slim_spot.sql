CREATE TABLE `processed_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` varchar(128) NOT NULL,
	`source` varchar(20) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processed_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `processed_messages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE INDEX `idx_processed_at` ON `processed_messages` (`processedAt`);