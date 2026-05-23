CREATE TABLE `privateEventInquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`eventType` varchar(100) NOT NULL,
	`guests` int NOT NULL,
	`location` varchar(255) NOT NULL,
	`packageType` varchar(50) NOT NULL,
	`preferredDate` varchar(100),
	`notes` text,
	`estimatedMin` int NOT NULL,
	`estimatedMax` int NOT NULL,
	`peStatus` enum('new','contacted','confirmed','cancelled') NOT NULL DEFAULT 'new',
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `privateEventInquiries_id` PRIMARY KEY(`id`)
);
