-- Content-based recommendations: vectors for saved pictures, a handful of
-- interest centroids per person, the interactions they are built from, and a
-- frozen feed order so scrolling stays put.
--
-- The extension has to exist before any vector column does, so it goes first.
-- Nothing tunable is encoded below: the weights, the centroid cap, the decay
-- and the exploration ratio all live in the recommendations config, so moving
-- one never costs a migration.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."centroid_origin" AS ENUM('category-seed', 'interaction');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('view', 'like', 'save', 'share', 'hide');--> statement-breakpoint
CREATE TYPE "public"."search_category" AS ENUM('backgrounds', 'fashion', 'nature', 'science', 'education', 'feelings', 'health', 'people', 'religion', 'places', 'animals', 'industry', 'computer', 'food', 'sports', 'transportation', 'travel', 'buildings', 'business', 'music');--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" "interaction_type" NOT NULL,
	"weight" real NOT NULL,
	"dwell_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_interest_centroids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"centroid" vector(1536) NOT NULL,
	"weight" real DEFAULT 0 NOT NULL,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"origin" "centroid_origin" NOT NULL,
	"last_reinforced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_embeddings" (
	"category" "search_category" PRIMARY KEY NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"source_text" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_categories" (
	"user_id" uuid NOT NULL,
	"category" "search_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_categories_user_id_category_pk" PRIMARY KEY("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "feed_slates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_ids" uuid[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_impressions" (
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"served_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_impressions_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "embedded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "embedding_input_hash" text;--> statement-breakpoint
ALTER TABLE "collection_items" ADD COLUMN "embedding_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_item_id_collection_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest_centroids" ADD CONSTRAINT "user_interest_centroids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_slates" ADD CONSTRAINT "feed_slates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_impressions" ADD CONSTRAINT "feed_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_impressions" ADD CONSTRAINT "feed_impressions_item_id_collection_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_user_time_idx" ON "interactions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_user_item_act_idx" ON "interactions" USING btree ("user_id","item_id","type") WHERE "interactions"."type" <> 'view';--> statement-breakpoint
CREATE INDEX "user_interest_centroids_user_idx" ON "user_interest_centroids" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feed_slates_user_idx" ON "feed_slates" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feed_slates_expiry_idx" ON "feed_slates" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "feed_impressions_served_idx" ON "feed_impressions" USING btree ("served_at");--> statement-breakpoint
CREATE INDEX "collection_items_embedding_idx" ON "collection_items" USING hnsw ("embedding" vector_ip_ops) WITH (m=16,ef_construction=64) WHERE "collection_items"."is_public" and "collection_items"."embedding" is not null;--> statement-breakpoint
CREATE INDEX "collection_items_embedding_pending_idx" ON "collection_items" USING btree ("created_at") WHERE "collection_items"."embedding" is null;--> statement-breakpoint
-- A board owns its visibility, but a partial index cannot look across a join,
-- so each item carries a copy. Two triggers keep it honest: one for the item
-- (set on insert, and whenever it is moved to another board), one for the
-- board (a visibility change rewrites its items).
UPDATE "collection_items" ci
   SET "is_public" = true
  FROM "collections" c
 WHERE c."id" = ci."collection_id"
   AND c."visibility" = 'public';--> statement-breakpoint
CREATE FUNCTION "collection_items_sync_is_public"() RETURNS trigger AS $$
BEGIN
  NEW."is_public" := EXISTS (
    SELECT 1 FROM "collections" c
     WHERE c."id" = NEW."collection_id" AND c."visibility" = 'public'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "collection_items_is_public"
BEFORE INSERT OR UPDATE OF "collection_id" ON "collection_items"
FOR EACH ROW EXECUTE FUNCTION "collection_items_sync_is_public"();--> statement-breakpoint
CREATE FUNCTION "collections_sync_items_is_public"() RETURNS trigger AS $$
BEGIN
  UPDATE "collection_items"
     SET "is_public" = (NEW."visibility" = 'public')
   WHERE "collection_id" = NEW."id";
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "collections_is_public"
AFTER UPDATE OF "visibility" ON "collections"
FOR EACH ROW WHEN (OLD."visibility" IS DISTINCT FROM NEW."visibility")
EXECUTE FUNCTION "collections_sync_items_is_public"();
