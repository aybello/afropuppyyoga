-- New claim tables protect future sends and completions without altering
-- existing review or training history.
CREATE TABLE `reviewTextDeliveryClaims` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lumaEventId` varchar(128) NOT NULL,
  `lumaGuestId` varchar(128) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `reviewTextDeliveryClaims_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_reviewTextDeliveryClaims_event_guest` UNIQUE(`lumaEventId`,`lumaGuestId`)
);
--> statement-breakpoint
CREATE TABLE `staffTrainingCompletionClaims` (
  `id` int AUTO_INCREMENT NOT NULL,
  `staffId` int NOT NULL,
  `moduleKey` varchar(128) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `staffTrainingCompletionClaims_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_staffTrainingCompletionClaims_staff_module` UNIQUE(`staffId`,`moduleKey`)
);
