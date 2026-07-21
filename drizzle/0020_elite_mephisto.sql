CREATE TABLE `callLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lumaEventId` varchar(128) NOT NULL,
	`eventName` varchar(255) NOT NULL,
	`guestName` varchar(255) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`callSid` varchar(64),
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`calledAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `callLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metaConversionEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lumaGuestId` varchar(128) NOT NULL,
	`lumaEventId` varchar(128) NOT NULL,
	`lumaEventName` varchar(255),
	`amountCents` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'cad',
	`lumaRegisteredAt` bigint NOT NULL,
	`hashedEmail` varchar(64),
	`hashedPhone` varchar(64),
	`hashedFirstName` varchar(64),
	`hashedLastName` varchar(64),
	`utmSource` varchar(255),
	`metaStatus` enum('pending','processing','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`metaEventId` varchar(255),
	`lastError` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metaConversionEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `metaConversionEvents_lumaGuestId_unique` UNIQUE(`lumaGuestId`)
);
--> statement-breakpoint
ALTER TABLE `puppySchedule` MODIFY COLUMN `dayOfWeek` enum('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL;--> statement-breakpoint
ALTER TABLE `puppySchedule` ADD `startTime` varchar(5) DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `puppySchedule` ADD `endTime` varchar(5) DEFAULT '15:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `puppySchedule` ADD `classType` enum('regular','private') DEFAULT 'regular' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_callLogs_lumaEventId` ON `callLogs` (`lumaEventId`);--> statement-breakpoint
CREATE INDEX `idx_callLogs_status` ON `callLogs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_meta_status` ON `metaConversionEvents` (`metaStatus`);--> statement-breakpoint
CREATE INDEX `idx_meta_lumaEventId` ON `metaConversionEvents` (`lumaEventId`);--> statement-breakpoint
CREATE INDEX `idx_meta_lumaRegisteredAt` ON `metaConversionEvents` (`lumaRegisteredAt`);