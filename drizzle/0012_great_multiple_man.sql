ALTER TABLE `conversations` ADD `humanMode` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `humanModeUntil` timestamp;