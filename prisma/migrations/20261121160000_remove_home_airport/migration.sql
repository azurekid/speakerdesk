-- Home airport is no longer collected (most people don't know IATA codes, and organizers ask
-- for travel details after acceptance). Erase it now; the column stays until the next release
-- because the previous app version still selects it during rollout.
-- FOLLOW-UP (next release, together with phone/dietaryRestrictions/accessibilityNeeds):
--   ALTER TABLE "speaker_profile" DROP COLUMN "homeAirport";
UPDATE "speaker_profile" SET "homeAirport" = '' WHERE "homeAirport" <> '';
