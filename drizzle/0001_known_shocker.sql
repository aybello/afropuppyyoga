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
	`metaStatus` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
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
CREATE INDEX `idx_meta_status` ON `metaConversionEvents` (`metaStatus`);--> statement-breakpoint
CREATE INDEX `idx_meta_lumaEventId` ON `metaConversionEvents` (`lumaEventId`);--> statement-breakpoint
CREATE INDEX `idx_meta_lumaRegisteredAt` ON `metaConversionEvents` (`lumaRegisteredAt`);