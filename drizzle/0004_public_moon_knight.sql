CREATE TABLE `partnershipInquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnershipType` enum('Corporate Wellness','Brand Collaboration','Media & Production','Local Business','Breeder Partnership') NOT NULL,
	`organizationName` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`website` varchar(500),
	`proposal` text NOT NULL,
	`partnerStatus` enum('new','reviewing','active','declined') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnershipInquiries_id` PRIMARY KEY(`id`)
);
