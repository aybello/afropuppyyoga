CREATE TABLE `staffingMutationLocks` (
	`lockName` varchar(128) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffingMutationLocks_lockName` PRIMARY KEY(`lockName`)
);
