CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_slug" text NOT NULL,
	"zone_name" text NOT NULL,
	"danger_level" integer NOT NULL,
	"danger_name" text NOT NULL,
	"action" text NOT NULL,
	"label" text NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalation_reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"webhook_status" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"cooldown_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_zone_slug_idx" ON "notifications" ("zone_slug");
--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX "notifications_cooldown_key_idx" ON "notifications" ("cooldown_key", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_danger_level" integer,
	"min_problem_count" integer,
	"zone_slug" text,
	"action" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
