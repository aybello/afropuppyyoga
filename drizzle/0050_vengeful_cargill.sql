ALTER TABLE `cancellationCredits` DROP INDEX `uq_cancellationCredits_code`;--> statement-breakpoint
CREATE INDEX `idx_cancellationCredits_code` ON `cancellationCredits` (`couponCode`);