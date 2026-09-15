DROP INDEX "messages_conversation_created_idx";--> statement-breakpoint
--> Add the column empty and fill it in the order the messages were written,
--> then hand over to the sequence. A plain bigserial would number the rows that
--> already exist in whatever physical order the table happens to be in.
ALTER TABLE "messages" ADD COLUMN "seq" bigint;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "messages_seq_seq" OWNED BY "messages"."seq";--> statement-breakpoint
UPDATE "messages" AS m
SET "seq" = ordered."rank"
FROM (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS "rank" FROM "messages"
) AS ordered
WHERE m."id" = ordered."id";--> statement-breakpoint
SELECT setval('messages_seq_seq', COALESCE((SELECT max("seq") FROM "messages"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "seq" SET DEFAULT nextval('messages_seq_seq');--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "seq" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_conversation_seq_idx" ON "messages" USING btree ("conversation_id","seq" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_seq_unique" UNIQUE("seq");
