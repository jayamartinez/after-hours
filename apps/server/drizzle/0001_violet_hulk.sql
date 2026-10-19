-- Soft-deleted memories become hard deletes: remove them before dropping the flag.
DELETE FROM "memories" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "memories" DROP COLUMN "deleted_at";
