CREATE TABLE `breeders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255),
	`phone` varchar(255),
	`email` varchar(320),
	`instagram` varchar(255),
	`breed` varchar(255),
	`litterTimeline` varchar(255),
	`typicalRate` varchar(100),
	`transport` varchar(255),
	`contractStatus` enum('No contract yet','Contract sent','Contract completed') NOT NULL DEFAULT 'No contract yet',
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `breeders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_breeders_contractStatus` ON `breeders` (`contractStatus`);--> statement-breakpoint
CREATE INDEX `idx_breeders_isActive` ON `breeders` (`isActive`);