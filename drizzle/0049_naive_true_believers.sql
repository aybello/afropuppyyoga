CREATE TABLE `quickbooksConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`realmId` varchar(64) NOT NULL,
	`companyName` varchar(255),
	`accessTokenCiphertext` text NOT NULL,
	`refreshTokenCiphertext` text NOT NULL,
	`tokenExpiresAt` timestamp NOT NULL,
	`refreshTokenExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`scheduleTaskUid` varchar(65),
	`lastSyncAt` timestamp,
	`quickbooksLastSyncStatus` enum('never','running','succeeded','failed') NOT NULL DEFAULT 'never',
	`lastSyncError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quickbooksConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_quickbooksConnections_realm` UNIQUE(`realmId`),
	CONSTRAINT `uq_quickbooksConnections_schedule` UNIQUE(`scheduleTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `quickbooksOAuthStates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stateHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quickbooksOAuthStates_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_quickbooksOAuthStates_hash` UNIQUE(`stateHash`)
);
--> statement-breakpoint
CREATE TABLE `quickbooksSyncRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`quickbooksSyncTrigger` enum('manual','daily') NOT NULL,
	`quickbooksSyncStatus` enum('running','succeeded','failed','skipped') NOT NULL,
	`importedCount` int NOT NULL DEFAULT 0,
	`updatedCount` int NOT NULL DEFAULT 0,
	`errorSummary` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `quickbooksSyncRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quickbooksTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceTransactionId` varchar(100) NOT NULL,
	`transactionDate` varchar(10) NOT NULL,
	`quickbooksTransactionDirection` enum('expense','income','transfer','other') NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'CAD',
	`categoryName` varchar(255),
	`accountName` varchar(255),
	`payeeName` varchar(255),
	`description` text,
	`sourceUpdatedAt` timestamp,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quickbooksTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_quickbooksTransactions_source` UNIQUE(`connectionId`,`sourceType`,`sourceTransactionId`)
);
--> statement-breakpoint
CREATE INDEX `idx_quickbooksOAuthStates_expiry` ON `quickbooksOAuthStates` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_quickbooksSyncRuns_connection` ON `quickbooksSyncRuns` (`connectionId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `idx_quickbooksTransactions_connection_date` ON `quickbooksTransactions` (`connectionId`,`transactionDate`);--> statement-breakpoint
CREATE INDEX `idx_quickbooksTransactions_direction` ON `quickbooksTransactions` (`connectionId`,`quickbooksTransactionDirection`,`transactionDate`);