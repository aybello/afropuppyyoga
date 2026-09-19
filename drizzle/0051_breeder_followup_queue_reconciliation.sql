-- Reconciles the original 0028 follow-up queue with the current operations dashboard schema.
-- This is additive: legacy columns and the old dueAt index are retained for audit safety.
-- TiDB's IF NOT EXISTS clauses make a recovery retry safe if a prior DDL statement completed.
SET time_zone = '+00:00';
--> statement-breakpoint
ALTER TABLE `breederLeadFollowUps` ADD COLUMN IF NOT EXISTS `scheduledAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `breederLeadFollowUps` ADD COLUMN IF NOT EXISTS `message` text;
--> statement-breakpoint
ALTER TABLE `breederLeadFollowUps` ADD COLUMN IF NOT EXISTS `channel` enum('sms','email','kijiji','phone','other') NOT NULL DEFAULT 'sms';
--> statement-breakpoint
ALTER TABLE `breederLeadFollowUps` ADD COLUMN IF NOT EXISTS `status` enum('pending','sent','skipped','cancelled') NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `breederLeadFollowUps` ADD COLUMN IF NOT EXISTS `sentAt` timestamp NULL;
--> statement-breakpoint
UPDATE `breederLeadFollowUps`
SET
  `scheduledAt` = CASE
    WHEN `dueAt` IS NOT NULL AND `scheduledAt` IS NULL AND `dueAt` BETWEEN 0 AND 2147483647000 THEN FROM_UNIXTIME(FLOOR(`dueAt` / 1000))
    WHEN `scheduledAt` IS NULL THEN COALESCE(`createdAt`, CURRENT_TIMESTAMP)
    ELSE `scheduledAt`
  END,
  `message` = CASE WHEN `dueAt` IS NOT NULL THEN `note` ELSE `message` END,
  `channel` = CASE WHEN `dueAt` IS NOT NULL THEN 'other' ELSE `channel` END,
  `status` = CASE WHEN `dueAt` IS NOT NULL THEN CASE WHEN `completed` = 1 THEN 'sent' ELSE 'pending' END ELSE `status` END,
  `sentAt` = CASE
    WHEN `dueAt` IS NOT NULL AND `completedAt` BETWEEN 0 AND 2147483647000 THEN FROM_UNIXTIME(FLOOR(`completedAt` / 1000))
    ELSE `sentAt`
  END;
--> statement-breakpoint
ALTER TABLE `breederLeadFollowUps`
  MODIFY COLUMN `scheduledAt` timestamp NOT NULL,
  MODIFY COLUMN `dueAt` bigint NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_breederLeadFollowUps_scheduledAt` ON `breederLeadFollowUps` (`scheduledAt`);
