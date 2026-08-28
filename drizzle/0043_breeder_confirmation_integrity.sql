ALTER TABLE `breederConfirmations`
  MODIFY COLUMN `confStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  ADD COLUMN `sentToPhone` varchar(20) NULL,
  ADD COLUMN `requestKey` varchar(64) NULL,
  ADD CONSTRAINT `breederConfirmations_requestKey_unique` UNIQUE(`requestKey`);
