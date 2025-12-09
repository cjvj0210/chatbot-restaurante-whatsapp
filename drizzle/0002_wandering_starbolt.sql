CREATE TABLE `test_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(255) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`messageType` enum('text','audio') NOT NULL DEFAULT 'text',
	`audioUrl` text,
	`transcription` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(255) NOT NULL,
	`userAgent` text,
	`ipAddress` varchar(45),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
