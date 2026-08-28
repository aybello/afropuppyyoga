ALTER TABLE `invoices`
  ADD COLUMN `fileSha256` varchar(64),
  ADD COLUMN `totalAmountCents` int,
  ADD COLUMN `invoiceWorkflowStatus` enum('submitted','reviewed','approved','paid') NOT NULL DEFAULT 'submitted',
  ADD COLUMN `submittedByUserId` int,
  ADD COLUMN `submittedByName` varchar(255),
  ADD COLUMN `submittedByEmail` varchar(320),
  ADD COLUMN `reviewedByUserId` int,
  ADD COLUMN `reviewedAt` timestamp NULL,
  ADD COLUMN `approvedByUserId` int,
  ADD COLUMN `approvedAt` timestamp NULL,
  ADD COLUMN `paidByUserId` int,
  ADD COLUMN `paidAt` timestamp NULL,
  ADD COLUMN `deletedAt` timestamp NULL,
  ADD INDEX `idx_invoices_workflow` (`invoiceWorkflowStatus`),
  ADD UNIQUE INDEX `uq_invoices_fileKey` (`fileKey`),
  ADD UNIQUE INDEX `uq_invoices_fileSha256` (`fileSha256`);

CREATE TABLE `smsSuppressions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `phone` varchar(20) NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `keyword` varchar(32),
  `sourceTwilioSid` varchar(64),
  `suppressedAt` timestamp NOT NULL DEFAULT (now()),
  `reactivatedAt` timestamp NULL,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `smsSuppressions_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_smsSuppressions_phone` UNIQUE(`phone`)
);

CREATE TABLE `cancellationCredits` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lumaEventId` varchar(128) NOT NULL,
  `eventName` varchar(255) NOT NULL,
  `couponCode` varchar(20) NOT NULL,
  `maxUses` int NOT NULL,
  `registrationClosedAt` timestamp NOT NULL,
  `couponCreatedAt` timestamp NOT NULL,
  `createdByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `cancellationCredits_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_cancellationCredits_event` UNIQUE(`lumaEventId`),
  CONSTRAINT `uq_cancellationCredits_code` UNIQUE(`couponCode`)
);
