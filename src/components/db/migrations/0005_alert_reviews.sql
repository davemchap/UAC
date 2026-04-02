CREATE TABLE "alert_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"zone_slug" text NOT NULL,
	"danger_level" integer NOT NULL,
	"ai_alert_id" integer,
	"original_text" text NOT NULL,
	"edited_text" text,
	"decision" text NOT NULL,
	"rejection_reason" text,
	"reviewer_username" text NOT NULL,
	"reviewer_role" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now()
);
