CREATE TABLE IF NOT EXISTS `inboundSmsReplyLocks` (
	`inboundSmsId` int NOT NULL,
	`idempotencyKey` varchar(160) NOT NULL,
	`bodyHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inboundSmsReplyLocks_inboundSmsId` PRIMARY KEY(`inboundSmsId`)
);
