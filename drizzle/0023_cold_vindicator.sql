ALTER TABLE `privateEventInquiries` MODIFY COLUMN `peStatus` enum('new','contacted','confirmed','cancelled','quote_sent','booked') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `finalPriceCents` int;--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `hstCents` int;--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `pricingType` varchar(20);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `sessions` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `puppyBreed` varchar(100);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `organization` varchar(255);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `lumaEventUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `lumaEventId` varchar(100);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `ownerApproved` boolean;--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `quoteSentAt` timestamp;