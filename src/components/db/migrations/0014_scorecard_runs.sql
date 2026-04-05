CREATE TABLE IF NOT EXISTS "scorecard_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "forecast_id" integer NOT NULL,
  "zone_id" integer NOT NULL,
  "zone_name" text NOT NULL,
  "forecaster_name" text,
  "date_issued" text NOT NULL,
  "persona_id" text NOT NULL,
  "persona_name" text NOT NULL,
  "overall_score" real NOT NULL,
  "clarity_score" real NOT NULL,
  "actionability_score" real NOT NULL,
  "jargon_load" real NOT NULL,
  "decision_confidence" text NOT NULL,
  "flag_count" integer NOT NULL DEFAULT 0,
  "most_common_flag" text,
  "scored_at" timestamp DEFAULT now()
);
