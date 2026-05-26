CREATE INDEX `idx_birthday_status` ON `birthdayInquiries` (`inquiryStatus`);--> statement-breakpoint
CREATE INDEX `idx_invoices_status` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jobapps_status` ON `jobApplications` (`appStatus`);--> statement-breakpoint
CREATE INDEX `idx_jobapps_email` ON `jobApplications` (`email`);--> statement-breakpoint
CREATE INDEX `idx_partnership_status` ON `partnershipInquiries` (`partnerStatus`);--> statement-breakpoint
CREATE INDEX `idx_pe_status` ON `privateEventInquiries` (`peStatus`);--> statement-breakpoint
CREATE INDEX `idx_staff_isActive` ON `staffInvites` (`isActive`);--> statement-breakpoint
CREATE INDEX `idx_staff_email` ON `staffInvites` (`email`);