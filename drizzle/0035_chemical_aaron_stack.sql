ALTER TABLE `jobApplications` ADD `isTeamMember` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_jobapps_team_member` ON `jobApplications` (`isTeamMember`);