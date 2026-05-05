CREATE TABLE `staffInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(128) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`expiresAt` timestamp NOT NULL,
	`firstUsedAt` timestamp,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffInvites_token_unique` UNIQUE(`token`)
);
