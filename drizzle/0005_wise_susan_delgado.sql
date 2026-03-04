CREATE TABLE `menu_addon_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`menuItemId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` text,
	`isRequired` boolean NOT NULL DEFAULT false,
	`minSelections` int NOT NULL DEFAULT 0,
	`maxSelections` int NOT NULL DEFAULT 1,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_addon_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `menu_addon_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` text,
	`priceExtra` int NOT NULL DEFAULT 0,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menu_addon_options_id` PRIMARY KEY(`id`)
);
