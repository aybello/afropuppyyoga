CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceApplicationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`role` varchar(255) NOT NULL,
	`location` varchar(100) NOT NULL,
	`employmentStatus` enum('active','inactive') NOT NULL DEFAULT 'active',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_sourceApplicationId_unique` UNIQUE(`sourceApplicationId`)
);
--> statement-breakpoint
CREATE INDEX `idx_employees_status` ON `employees` (`employmentStatus`);--> statement-breakpoint
CREATE INDEX `idx_employees_location` ON `employees` (`location`);