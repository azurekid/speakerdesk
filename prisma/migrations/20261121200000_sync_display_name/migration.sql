-- The profile's display name is the name shown across the platform. Accounts whose profile name
-- was changed after sign-up still carried the sign-up name; bring them in line.
UPDATE "user" u SET "name" = p."fullName"
FROM "speaker_profile" p
WHERE p."userId" = u."id" AND btrim(p."fullName") <> '' AND u."name" <> btrim(p."fullName");
