-- The one-time "what do you like" step, asked once at account creation and
-- never again. Null means it is still owed, so every account that already
-- exists is stamped as done: they have been using the app for a while and
-- should not be stopped on their next visit to answer it.
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
