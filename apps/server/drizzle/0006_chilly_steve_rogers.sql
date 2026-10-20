CREATE TABLE "spend_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"micro_usd" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "spend_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "spend_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "spend_usage" ADD CONSTRAINT "spend_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;