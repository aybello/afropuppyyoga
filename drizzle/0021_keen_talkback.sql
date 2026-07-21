ALTER TABLE `callLogs` ADD `smsSid` varchar(64);--> statement-breakpoint
ALTER TABLE `callLogs` ADD `smsStatus` varchar(32) DEFAULT 'queued' NOT NULL;