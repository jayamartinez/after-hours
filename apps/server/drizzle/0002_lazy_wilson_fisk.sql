CREATE TABLE "credit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_credits" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plus_plan" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plus_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_events" ADD CONSTRAINT "credit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_events_user_ref_key" ON "credit_events" USING btree ("user_id","ref");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_image_credits_check" CHECK ("users"."image_credits" >= 0);