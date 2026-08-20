CREATE TABLE `staffAvailability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`staffName` varchar(255) NOT NULL,
	`leaveType` enum('vacation','sick','personal','leave','unavailable') NOT NULL,
	`startDate` varchar(20) NOT NULL,
	`endDate` varchar(20) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffAvailability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_staffAvailability_staffId` ON `staffAvailability` (`staffId`);--> statement-breakpoint
CREATE INDEX `idx_staffAvailability_dates` ON `staffAvailability` (`startDate`,`endDate`);