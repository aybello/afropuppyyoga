ALTER TABLE `breederConfirmations`
  MODIFY COLUMN `confStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending';

ALTER TABLE `breederConfirmations`
  ADD COLUMN `sentToPhone` varchar(20) NULL,
  ADD COLUMN `requestKey` varchar(64) NULL;

CREATE UNIQUE INDEX `breederConfirmations_requestKey_unique` ON `breederConfirmations` (`requestKey`);
