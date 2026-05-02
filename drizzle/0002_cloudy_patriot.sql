CREATE TABLE `jobApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` varchar(255) NOT NULL,
	`location` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`whyAPY` text,
	`experience` text,
	`videoUrl` text,
	`videoKey` varchar(500),
	`appStatus` enum('new','reviewed','shortlisted','rejected') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobApplications_id` PRIMARY KEY(`id`)
);
