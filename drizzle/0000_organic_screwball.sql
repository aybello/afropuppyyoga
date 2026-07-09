DROP TABLE `birthdayInquiries`;--> statement-breakpoint
DROP TABLE `breederAvailabilityBlasts`;--> statement-breakpoint
DROP TABLE `breederAvailabilityResponses`;--> statement-breakpoint
DROP TABLE `breederConfirmations`;--> statement-breakpoint
DROP TABLE `breeders`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
DROP TABLE `jobApplications`;--> statement-breakpoint
DROP TABLE `locationPresets`;--> statement-breakpoint
DROP TABLE `partnershipInquiries`;--> statement-breakpoint
DROP TABLE `privateEventInquiries`;--> statement-breakpoint
DROP TABLE `puppySchedule`;--> statement-breakpoint
DROP TABLE `refunds`;--> statement-breakpoint
DROP TABLE `signingTokens`;--> statement-breakpoint
DROP TABLE `staffInvites`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin') NOT NULL DEFAULT 'user';