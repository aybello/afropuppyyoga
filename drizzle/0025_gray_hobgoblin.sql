CREATE TABLE `inboundSms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromPhone` varchar(20) NOT NULL,
	`toPhone` varchar(20) NOT NULL,
	`body` text NOT NULL,
	`twilioSid` varchar(64) NOT NULL,
	`breederId` int,
	`breederName` varchar(255),
	`isRead` int NOT NULL DEFAULT 0,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inboundSms_id` PRIMARY KEY(`id`),
	CONSTRAINT `inboundSms_twilioSid_unique` UNIQUE(`twilioSid`)
);
--> statement-breakpoint
CREATE INDEX `idx_inbound_sms_fromPhone` ON `inboundSms` (`fromPhone`);--> statement-breakpoint
CREATE INDEX `idx_inbound_sms_breederId` ON `inboundSms` (`breederId`);--> statement-breakpoint
CREATE INDEX `idx_inbound_sms_isRead` ON `inboundSms` (`isRead`);