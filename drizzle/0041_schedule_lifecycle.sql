ALTER TABLE `puppySchedule`
  ADD COLUMN `scheduleStatus` enum('scheduled','cancelled','completed','archived') NOT NULL DEFAULT 'scheduled',
  ADD COLUMN `lumaSyncStatus` enum('not_required','pending','synced','failed') NOT NULL DEFAULT 'pending',
  ADD COLUMN `lumaSyncedAt` timestamp NULL,
  ADD COLUMN `archivedAt` timestamp NULL;

CREATE INDEX `idx_schedule_status` ON `puppySchedule` (`scheduleStatus`);

UPDATE `puppySchedule`
SET
  `lumaSyncStatus` = CASE
    WHEN `classType` = 'private' THEN 'not_required'
    WHEN `lumaEventId` IS NOT NULL THEN 'synced'
    ELSE 'pending'
  END,
  `lumaSyncedAt` = CASE WHEN `lumaEventId` IS NOT NULL THEN `updatedAt` ELSE NULL END;
