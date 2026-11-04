CREATE TABLE `employeeApplicationAssociations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`employeeId` int NOT NULL,
	`canonicalApplicationId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`actorName` varchar(255),
	`actorEmail` varchar(320),
	`recordHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employeeApplicationAssociations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_employeeApplicationAssociations_application` UNIQUE(`applicationId`)
);
--> statement-breakpoint
ALTER TABLE `employeeApplicationAssociations` ADD CONSTRAINT `fk_emp_app_assoc_application` FOREIGN KEY (`applicationId`) REFERENCES `jobApplications`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `employeeApplicationAssociations` ADD CONSTRAINT `fk_emp_app_assoc_employee` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `employeeApplicationAssociations` ADD CONSTRAINT `fk_emp_app_assoc_canonical` FOREIGN KEY (`canonicalApplicationId`) REFERENCES `jobApplications`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `idx_employeeApplicationAssociations_employee` ON `employeeApplicationAssociations` (`employeeId`);