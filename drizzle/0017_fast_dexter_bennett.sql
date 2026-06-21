CREATE TABLE `refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerEmail` varchar(320),
	`orderRef` varchar(255),
	`eventName` varchar(255),
	`refundLocation` enum('Hamilton','Kitchener','Oakville','Other') NOT NULL DEFAULT 'Other',
	`amountCents` int NOT NULL,
	`refundReason` enum('Customer request','Event cancelled','Event rescheduled','Duplicate charge','No show','Medical / emergency','Other') NOT NULL DEFAULT 'Customer request',
	`notes` text,
	`refundMethod` enum('Stripe','E-Transfer','Cash','Credit','Other') NOT NULL DEFAULT 'Stripe',
	`refundStatus` enum('Pending','Processed','Denied') NOT NULL DEFAULT 'Pending',
	`requestedAt` bigint NOT NULL,
	`processedAt` bigint,
	`processedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_refunds_status` ON `refunds` (`refundStatus`);--> statement-breakpoint
CREATE INDEX `idx_refunds_location` ON `refunds` (`refundLocation`);--> statement-breakpoint
CREATE INDEX `idx_refunds_requestedAt` ON `refunds` (`requestedAt`);