CREATE TABLE `breederConfirmations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`breederId` int NOT NULL,
	`breederName` varchar(255) NOT NULL,
	`sentToEmail` varchar(320) NOT NULL,
	`events` text NOT NULL,
	`availabilityNote` text,
	`emailBody` text NOT NULL,
	`confStatus` enum('sent','failed') NOT NULL DEFAULT 'sent',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `breederConfirmations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locationPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(255) NOT NULL,
	`city` varchar(100) NOT NULL,
	`address` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locationPresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_conf_breederId` ON `breederConfirmations` (`breederId`);