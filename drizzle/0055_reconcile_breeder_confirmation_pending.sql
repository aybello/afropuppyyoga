-- Reconciles a legacy imported breeder confirmation table with the status
-- lifecycle that the current confirmation workflow already requires.
-- Existing sent/failed records are preserved. The added pending status is used
-- only while APY provisionally creates the confirmation before delivering email
-- or SMS, preventing duplicate class creation on a retry.
ALTER TABLE `breederConfirmations`
  MODIFY COLUMN `confStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending';
