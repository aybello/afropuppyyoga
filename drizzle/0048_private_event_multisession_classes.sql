CREATE TABLE `privateEventClasses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inquiryId` int NOT NULL,
	`sessionNumber` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`privateEventClassPaymentMode` enum('combined_checkout','included') NOT NULL,
	`lumaEventId` varchar(100) NOT NULL,
	`lumaEventUrl` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `privateEventClasses_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_privateEventClasses_inquiry_session` UNIQUE(`inquiryId`,`sessionNumber`),
	CONSTRAINT `uq_privateEventClasses_lumaEvent` UNIQUE(`lumaEventId`)
);
--> statement-breakpoint
CREATE INDEX `idx_privateEventClasses_inquiry` ON `privateEventClasses` (`inquiryId`);