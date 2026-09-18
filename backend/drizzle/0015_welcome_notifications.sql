-- A notification that comes from nobody, about no board: the one waiting in a
-- new account's inbox. Both foreign keys become optional so it can exist, and
-- the read query left-joins them rather than inner-joining, which would have
-- quietly dropped it from the list.
ALTER TYPE "public"."notification_type" ADD VALUE 'welcome' BEFORE 'item_added';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "collection_id" DROP NOT NULL;