INSERT INTO `employees` (
  `sourceApplicationId`,
  `name`,
  `email`,
  `phone`,
  `role`,
  `location`,
  `employmentStatus`,
  `startedAt`,
  `endedAt`
)
SELECT
  `id`,
  `name`,
  `email`,
  `phone`,
  `role`,
  `location`,
  CASE WHEN `deletedAt` IS NULL THEN 'active' ELSE 'inactive' END,
  COALESCE(`createdAt`, NOW()),
  `deletedAt`
FROM `jobApplications`
WHERE `isTeamMember` = TRUE
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `email` = VALUES(`email`),
  `phone` = VALUES(`phone`),
  `role` = VALUES(`role`),
  `location` = VALUES(`location`),
  `employmentStatus` = VALUES(`employmentStatus`),
  `endedAt` = VALUES(`endedAt`);
