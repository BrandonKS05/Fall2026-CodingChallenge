ALTER TYPE "public"."image_provider" ADD VALUE 'upload';--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "source_url" DROP NOT NULL;