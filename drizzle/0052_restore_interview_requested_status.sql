-- Restores the application status already supported by the current APY application code.
-- This expands the permitted enum values only; it does not modify any applicant records.
ALTER TABLE `jobApplications`
  MODIFY COLUMN `appStatus` enum('new','reviewed','shortlisted','interview_requested','interview_scheduled','accepted','rejected','onboarded') NOT NULL DEFAULT 'new';
