ALTER TABLE "users" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "handle_changed_at" timestamp with time zone;--> statement-breakpoint
--> Accounts that predate handles get one from their email: the local part with
--> anything unusable stripped, padded when it is too short, and numbered when two
--> people would otherwise land on the same name. Mirrors handleFromSeed().
WITH stems AS (
  SELECT
    "id",
    "created_at",
    left(
      coalesce(
        nullif(
          regexp_replace(
            regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9_]', '', 'g'),
            '^_+',
            ''
          ),
          ''
        ),
        'friend'
      ),
      22
    ) AS stem
  FROM "users"
), padded AS (
  SELECT
    "id",
    "created_at",
    CASE WHEN length("stem") < 3 THEN rpad("stem", 3, '1') ELSE "stem" END AS "stem"
  FROM stems
), numbered AS (
  SELECT
    "id",
    "stem",
    row_number() OVER (PARTITION BY "stem" ORDER BY "created_at", "id") AS "n"
  FROM padded
)
UPDATE "users" AS u
SET "handle" = CASE WHEN n."n" = 1 THEN n."stem" ELSE n."stem" || n."n"::text END
FROM numbered AS n
WHERE u."id" = n."id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "handle" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_handle_unique" UNIQUE("handle");
