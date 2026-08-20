ALTER TABLE `privateEventInquiries` ADD `eventVenue` varchar(255);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `eventStartTime` varchar(5);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `eventEndTime` varchar(5);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `quoteEmailSubject` varchar(500);--> statement-breakpoint
ALTER TABLE `privateEventInquiries` ADD `quoteEmailBody` text;