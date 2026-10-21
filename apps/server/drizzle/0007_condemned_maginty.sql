CREATE TABLE "global_spend" (
	"day" date PRIMARY KEY NOT NULL,
	"micro_usd" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "global_spend" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "network_sessions" (
	"network" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "network_sessions_network_day_pk" PRIMARY KEY("network","day")
);
--> statement-breakpoint
ALTER TABLE "network_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "network_spend" (
	"network" text PRIMARY KEY NOT NULL,
	"micro_usd" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "network_spend" ENABLE ROW LEVEL SECURITY;