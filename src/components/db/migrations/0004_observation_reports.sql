CREATE TABLE "observation_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text,
	"content_text" text,
	"content_image_url" text,
	"lat" real,
	"lng" real,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"ai_summary" text,
	"zone_slug" text,
	"hazard_type" text,
	"severity" text,
	"location_description" text,
	"impact_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "observer_handles" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"total_impact_points" integer DEFAULT 0 NOT NULL,
	"badge_level" text DEFAULT 'scout' NOT NULL,
	"reward_triggered" boolean DEFAULT false NOT NULL,
	"observation_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "observer_handles_handle_unique" UNIQUE("handle")
);
