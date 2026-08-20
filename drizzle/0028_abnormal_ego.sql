CREATE TABLE `breederLeadActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`activityType` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`performedBy` varchar(128),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `breederLeadActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `breederLeadFollowUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`dueAt` bigint NOT NULL,
	`note` text,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `breederLeadFollowUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `breederLeadMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`channel` varchar(16) NOT NULL,
	`direction` varchar(16) NOT NULL DEFAULT 'outbound',
	`body` text NOT NULL,
	`subject` varchar(512),
	`smsSid` varchar(64),
	`sentAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `breederLeadMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `breederLeads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`breed` varchar(128) NOT NULL,
	`sellerName` varchar(255),
	`phoneNumber` varchar(30),
	`email` varchar(320),
	`city` varchar(128),
	`province` varchar(64),
	`postalCode` varchar(16),
	`distanceKm` int,
	`puppyCount` int,
	`puppyAge` varchar(64),
	`expectedReadyDate` varchar(32),
	`listingPrice` int,
	`listingUrl` text,
	`listingTitle` varchar(512),
	`listingDescription` text,
	`listingImageUrls` text,
	`listingPostedAt` varchar(64),
	`qualificationScore` int,
	`qualificationReasons` text,
	`disqualificationReasons` text,
	`source` varchar(32) NOT NULL DEFAULT 'manual',
	`pipelineStatus` varchar(32) NOT NULL DEFAULT 'new',
	`lastContactedAt` bigint,
	`convertedBreederId` int,
	`internalNotes` text,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `breederLeads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_breederLeadActivities_leadId` ON `breederLeadActivities` (`leadId`);--> statement-breakpoint
CREATE INDEX `idx_breederLeadFollowUps_leadId` ON `breederLeadFollowUps` (`leadId`);--> statement-breakpoint
CREATE INDEX `idx_breederLeadFollowUps_dueAt` ON `breederLeadFollowUps` (`dueAt`);--> statement-breakpoint
CREATE INDEX `idx_breederLeadMessages_leadId` ON `breederLeadMessages` (`leadId`);--> statement-breakpoint
CREATE INDEX `idx_breederLeads_status` ON `breederLeads` (`pipelineStatus`);--> statement-breakpoint
CREATE INDEX `idx_breederLeads_breed` ON `breederLeads` (`breed`);