CREATE TABLE "message_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "message_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "message_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "image_credits" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bonus_messages" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_grants" ADD CONSTRAINT "message_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_usage" ADD CONSTRAINT "message_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_grants_user_ref_key" ON "message_grants" USING btree ("user_id","ref");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_bonus_messages_check" CHECK ("users"."bonus_messages" >= 0);