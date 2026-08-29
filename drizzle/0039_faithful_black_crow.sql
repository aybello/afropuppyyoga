CREATE TABLE `staffPhoneAccessCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(20) NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffPhoneAccessCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_staffPhoneAccess_phone_created` ON `staffPhoneAccessCodes` (`phone`,`createdAt`);--> statement-breakpoint
