CREATE TABLE `weekendLeadershipCoverage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coverageDate` varchar(10) NOT NULL,
	`weekendCoverageLocation` enum('KW','OAK','HAM') NOT NULL,
	`weekendCoverageRole` enum('Operations Manager','Yoga Instructor') NOT NULL,
	`coverageStaffId` int,
	`coverageStaffName` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekendLeadershipCoverage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_weekendCoverage_date` ON `weekendLeadershipCoverage` (`coverageDate`);--> statement-breakpoint
CREATE INDEX `idx_weekendCoverage_shift` ON `weekendLeadershipCoverage` (`coverageDate`,`weekendCoverageLocation`,`weekendCoverageRole`);