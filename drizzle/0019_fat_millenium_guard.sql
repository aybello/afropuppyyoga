CREATE TABLE `puppySchedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classDate` varchar(10) NOT NULL,
	`dayOfWeek` enum('Saturday','Sunday') NOT NULL,
	`schedLocation` enum('Kitchener','Hamilton','Oakville') NOT NULL,
	`breed` varchar(255) NOT NULL,
	`breederId` int NOT NULL,
	`breederName` varchar(255) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `puppySchedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_schedule_classDate` ON `puppySchedule` (`classDate`);--> statement-breakpoint
CREATE INDEX `idx_schedule_location` ON `puppySchedule` (`schedLocation`);--> statement-breakpoint
CREATE INDEX `idx_schedule_breederId` ON `puppySchedule` (`breederId`);