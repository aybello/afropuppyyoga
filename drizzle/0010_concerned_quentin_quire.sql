ALTER TABLE `invoices` MODIFY COLUMN `status` enum('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `invoices` ADD `amountPaidCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `paymentNotes` text;