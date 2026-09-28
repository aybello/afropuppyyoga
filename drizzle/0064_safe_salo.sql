ALTER TABLE `jobApplications` ADD `submissionKey` varchar(64);--> statement-breakpoint
ALTER TABLE `jobApplications` ADD CONSTRAINT `jobApplications_submissionKey_unique` UNIQUE(`submissionKey`);