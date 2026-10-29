CREATE TABLE `staffEmailAccessCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`identityType` enum('staff','owner') NOT NULL,
	`applicationId` int,
	`ownerOpenId` varchar(64),
	`codeHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffEmailAccessCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_staffEmailAccess_email_created` ON `staffEmailAccessCodes` (`email`,`createdAt`);