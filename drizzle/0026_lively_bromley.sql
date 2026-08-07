CREATE TABLE `reviewTextLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lumaEventId` varchar(128) NOT NULL,
	`lumaGuestId` varchar(128) NOT NULL,
	`eventName` varchar(255) NOT NULL,
	`eventEndAt` varchar(64) NOT NULL,
	`guestName` varchar(255) NOT NULL,
	`guestEmail` varchar(320),
	`phone` varchar(30) NOT NULL,
	`smsSid` varchar(64),
	`status` varchar(32) NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewTextLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_reviewTextLogs_lumaEventId` ON `reviewTextLogs` (`lumaEventId`);--> statement-breakpoint
CREATE INDEX `idx_reviewTextLogs_guest` ON `reviewTextLogs` (`lumaEventId`,`lumaGuestId`);