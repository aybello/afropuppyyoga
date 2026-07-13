CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffName` varchar(255),
	`position` varchar(255),
	`payAmount` varchar(100),
	`dueDate` timestamp,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`originalFilename` varchar(255),
	`status` enum('pending','paid','overdue') NOT NULL DEFAULT 'pending',
	`extractionStatus` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`extractedData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
