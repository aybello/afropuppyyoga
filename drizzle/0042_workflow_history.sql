ALTER TABLE `privateEventInquiries`
  ADD COLUMN `approvalStatus` enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft',
  ADD COLUMN `approvalRequestedAt` timestamp NULL,
  ADD COLUMN `approvalRequestedByUserId` int NULL,
  ADD COLUMN `approvalRequestedByName` varchar(255) NULL,
  ADD COLUMN `approvedAt` timestamp NULL,
  ADD COLUMN `approvedByUserId` int NULL,
  ADD COLUMN `approvedByName` varchar(255) NULL,
  ADD COLUMN `approvalRejectedAt` timestamp NULL,
  ADD COLUMN `approvalRejectedByUserId` int NULL,
  ADD COLUMN `approvalRejectionReason` text NULL,
  ADD COLUMN `bookingLinkPublishedAt` timestamp NULL;

UPDATE `privateEventInquiries`
SET
  `approvalStatus` = CASE
    WHEN `ownerApproved` = 1 THEN 'approved'
    WHEN `lumaEventId` IS NOT NULL OR `finalPriceCents` IS NOT NULL THEN 'pending'
    ELSE 'draft'
  END,
  `approvedAt` = CASE WHEN `ownerApproved` = 1 THEN `updatedAt` ELSE NULL END,
  `bookingLinkPublishedAt` = CASE WHEN `lumaEventId` IS NOT NULL THEN `updatedAt` ELSE NULL END;

CREATE TABLE `privateEventActions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `inquiryId` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `actorUserId` int NULL,
  `actorName` varchar(255) NULL,
  `actorEmail` varchar(320) NULL,
  `details` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `privateEventActions_id` PRIMARY KEY(`id`),
  INDEX `idx_privateEventActions_inquiry` (`inquiryId`, `createdAt`)
);

CREATE TABLE `jobApplicationActions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `applicationId` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `fromStatus` varchar(64) NULL,
  `toStatus` varchar(64) NULL,
  `actorUserId` int NULL,
  `actorName` varchar(255) NULL,
  `actorEmail` varchar(320) NULL,
  `details` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `jobApplicationActions_id` PRIMARY KEY(`id`),
  INDEX `idx_jobApplicationActions_application` (`applicationId`, `createdAt`)
);

CREATE TABLE `communicationsLog` (
  `id` int AUTO_INCREMENT NOT NULL,
  `entityType` enum('private_event','job_application','breeder','class','general') NOT NULL,
  `entityId` int NULL,
  `channel` enum('email','sms','call','system') NOT NULL,
  `direction` enum('outbound','inbound','system') NOT NULL,
  `action` varchar(64) NOT NULL,
  `recipient` varchar(320) NULL,
  `subject` varchar(500) NULL,
  `bodyPreview` text NULL,
  `deliveryStatus` varchar(32) NOT NULL DEFAULT 'sent',
  `providerMessageId` varchar(128) NULL,
  `actorUserId` int NULL,
  `actorName` varchar(255) NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `communicationsLog_id` PRIMARY KEY(`id`),
  INDEX `idx_communications_entity` (`entityType`, `entityId`, `createdAt`)
);
