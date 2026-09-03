CREATE TABLE `lumaReminderOutcomeReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleTaskUid` varchar(65) NOT NULL,
	`attemptDate` varchar(10) NOT NULL,
	`lumaReminderOutcomeRunStatus` enum('completed','safely_stopped','no_eligible_events') NOT NULL,
	`outcomeSummary` text NOT NULL,
	`lumaReminderOutcomeDeliveryStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`failureCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lumaReminderOutcomeReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_lumaReminderOutcomeReports_task_date` UNIQUE(`scheduleTaskUid`,`attemptDate`)
);
--> statement-breakpoint
CREATE INDEX `idx_lumaReminderOutcomeReports_delivery` ON `lumaReminderOutcomeReports` (`lumaReminderOutcomeDeliveryStatus`,`createdAt`);
