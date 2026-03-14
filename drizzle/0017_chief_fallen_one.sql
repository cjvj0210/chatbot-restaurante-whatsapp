CREATE INDEX `idx_conversations_human_mode` ON `conversations` (`humanMode`,`humanModeUntil`);--> statement-breakpoint
CREATE INDEX `idx_messages_created_role` ON `messages` (`createdAt`,`role`);