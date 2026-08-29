CREATE TABLE `staffTrainingProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`moduleKey` varchar(128) NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledgedBy` varchar(320),
	CONSTRAINT `staffTrainingProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_staffTraining_staff` ON `staffTrainingProgress` (`staffId`);
--> statement-breakpoint
CREATE INDEX `idx_staffTraining_module` ON `staffTrainingProgress` (`moduleKey`);
--> statement-breakpoint
CREATE TABLE `staffScheduleNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`staffId` int NOT NULL,
	`staffName` varchar(255) NOT NULL,
	`role` varchar(100) NOT NULL,
	`emailStatus` varchar(32) NOT NULL DEFAULT 'not_sent',
	`smsStatus` varchar(32) NOT NULL DEFAULT 'not_sent',
	`smsSid` varchar(64),
	`errorMessage` text,
	`sentBy` varchar(320),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffScheduleNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_staffScheduleNotifications_schedule` ON `staffScheduleNotifications` (`scheduleId`);
--> statement-breakpoint
CREATE INDEX `idx_staffScheduleNotifications_staff` ON `staffScheduleNotifications` (`staffId`);
