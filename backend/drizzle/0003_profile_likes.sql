ALTER TYPE "public"."notification_type" ADD VALUE 'collection_liked';--> statement-breakpoint
CREATE TABLE "collection_likes" (
	"collection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_likes_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "collection_items" DROP CONSTRAINT "collection_items_added_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_likes" ADD CONSTRAINT "collection_likes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_likes" ADD CONSTRAINT "collection_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_likes_collection_idx" ON "collection_likes" USING btree ("collection_id");--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;