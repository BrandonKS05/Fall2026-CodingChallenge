-- Phone sign-up is gone; an account is an email address again.
-- An account that only ever had a number has no way to sign in any more and
-- no address to move it to, so it goes with the feature.
DELETE FROM "users" WHERE "email" IS NULL;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone_verified_at";