CREATE TABLE `breederAvailabilityBlasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monthLabel` varchar(100) NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`emailedCount` int NOT NULL DEFAULT 0,
	`customMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `breederAvailabilityBlasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `breederAvailabilityResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blastId` int NOT NULL,
	`breederId` int NOT NULL,
	`breederName` varchar(255) NOT NULL,
	`breederEmail` varchar(320) NOT NULL,
	`token` varchar(64) NOT NULL,
	`responded` int NOT NULL DEFAULT 0,
	`availabilityText` text,
	`responseNotes` text,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `breederAvailabilityResponses_id` PRIMARY KEY(`id`),
	CONSTRAINT `breederAvailabilityResponses_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `idx_blasts_monthKey` ON `breederAvailabilityBlasts` (`monthKey`);--> statement-breakpoint
CREATE INDEX `idx_avail_blastId` ON `breederAvailabilityResponses` (`blastId`);--> statement-breakpoint
CREATE INDEX `idx_avail_breederId` ON `breederAvailabilityResponses` (`breederId`);--> statement-breakpoint
CREATE INDEX `idx_avail_token` ON `breederAvailabilityResponses` (`token`);