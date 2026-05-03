CREATE TABLE `birthdayInquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`preferredDate` varchar(100) NOT NULL,
	`location` enum('KW','Hamilton') NOT NULL,
	`tier` enum('Basic','Premium','Deluxe') NOT NULL,
	`groupSize` int NOT NULL,
	`message` text,
	`inquiryStatus` enum('new','contacted','confirmed','cancelled') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `birthdayInquiries_id` PRIMARY KEY(`id`)
);
