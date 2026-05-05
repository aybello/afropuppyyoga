CREATE TABLE `signingTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`applicantName` varchar(255) NOT NULL,
	`applicantEmail` varchar(320) NOT NULL,
	`role` varchar(255) NOT NULL,
	`location` varchar(100) NOT NULL,
	`offerLetterType` enum('puppy_monitor_kw','puppy_monitor_hamilton','yoga_instructor') NOT NULL,
	`token` varchar(128) NOT NULL,
	`signed` int NOT NULL DEFAULT 0,
	`signedName` varchar(255),
	`signedIp` varchar(64),
	`signedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signingTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `signingTokens_token_unique` UNIQUE(`token`)
);
