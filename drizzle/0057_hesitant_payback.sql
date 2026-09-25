ALTER TABLE `communicationsLog` ADD `idempotencyKey` varchar(160);--> statement-breakpoint
ALTER TABLE `communicationsLog` ADD CONSTRAINT `uq_communications_idempotency` UNIQUE(`idempotencyKey`);