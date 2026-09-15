-- The demo accounts were seeded under the app's old name. Rename them so the
-- idempotent seed recognizes them instead of creating a second set.
UPDATE "users"
SET "email" = replace("email", '@trove.app', '@wumboo.app')
WHERE "email" LIKE '%@trove.app';
