CREATE TABLE "field_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"observer_name" text NOT NULL,
	"observer_email" text NOT NULL,
	"experience_level" text NOT NULL,
	"zone_slug" text NOT NULL,
	"area_name" text,
	"aspect" text,
	"elevation_ft" integer,
	"observed_at" timestamp with time zone NOT NULL,
	"obs_types" text[] NOT NULL,
	"avalanche_type" text,
	"trigger" text,
	"size_r" integer,
	"size_d" integer,
	"width_ft" integer,
	"vertical_ft" integer,
	"depth_in" integer,
	"surface_conditions" text,
	"snow_depth_in" integer,
	"storm_snow_in" integer,
	"weak_layers" boolean,
	"weak_layers_desc" text,
	"sky_cover" text,
	"wind_speed" text,
	"wind_direction" text,
	"temperature_f" integer,
	"precip" text,
	"field_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "field_observations_zone_slug_idx" ON "field_observations" ("zone_slug");
--> statement-breakpoint
CREATE INDEX "field_observations_observed_at_idx" ON "field_observations" ("observed_at" DESC);
