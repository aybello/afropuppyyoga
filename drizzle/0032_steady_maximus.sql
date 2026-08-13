CREATE TABLE `classStaffAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`staffId` int NOT NULL,
	`staffName` varchar(255) NOT NULL,
	`classStaffRole` enum('Puppy Monitor') NOT NULL DEFAULT 'Puppy Monitor',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classStaffAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_classStaffAssignments_schedule` ON `classStaffAssignments` (`scheduleId`);--> statement-breakpoint
CREATE INDEX `idx_classStaffAssignments_staff` ON `classStaffAssignments` (`staffId`);