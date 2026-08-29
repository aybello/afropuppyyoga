ALTER TABLE `jobApplications` MODIFY COLUMN `appStatus` enum('new','reviewed','shortlisted','interview_requested','interview_scheduled','accepted','rejected','onboarded') NOT NULL DEFAULT 'new';
-- Before this migration, the system set interview_scheduled as soon as it emailed a booking link.
-- Preserve that historical meaning by moving those request records to the new explicit state.
UPDATE `jobApplications` SET `appStatus` = 'interview_requested' WHERE `appStatus` = 'interview_scheduled';
