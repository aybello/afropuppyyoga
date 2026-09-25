-- Bind only one-to-one historical email matches. Ambiguous and unmatched
-- invitations intentionally remain NULL and fail closed for owner review.
UPDATE `staffInvites` si
JOIN (
  SELECT si2.id AS invite_id, MIN(ja.id) AS application_id
  FROM `staffInvites` si2
  JOIN `jobApplications` ja ON LOWER(TRIM(ja.email)) = LOWER(TRIM(si2.email))
    AND ja.isTeamMember = 1
  WHERE si2.applicationId IS NULL
  GROUP BY si2.id
  HAVING COUNT(ja.id) = 1
) matched ON matched.invite_id = si.id
SET si.applicationId = matched.application_id
WHERE si.applicationId IS NULL;
