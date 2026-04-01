CREATE TABLE "alert_thresholds" (
	"id" serial PRIMARY KEY NOT NULL,
	"danger_level" integer NOT NULL,
	"name" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	CONSTRAINT "alert_thresholds_danger_level_unique" UNIQUE("danger_level")
);
--> statement-breakpoint
CREATE TABLE "avalanche_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"nid" text NOT NULL,
	"date_issued" text NOT NULL,
	"date_issued_timestamp" text,
	"overall_danger_rating" text NOT NULL,
	"avalanche_problem_1" text,
	"avalanche_problem_2" text,
	"avalanche_problem_3" text,
	"bottom_line" text,
	"current_conditions" text,
	"region" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "avalanche_forecasts_zone_id_nid_unique" UNIQUE("zone_id","nid")
);
--> statement-breakpoint
CREATE TABLE "avalanche_problems" (
	"id" serial PRIMARY KEY NOT NULL,
	"forecast_id" integer NOT NULL,
	"problem_number" integer NOT NULL,
	"problem_type" text NOT NULL,
	"description" text,
	"danger_rose" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "avalanche_problems_forecast_id_problem_number_unique" UNIQUE("forecast_id","problem_number")
);
--> statement-breakpoint
CREATE TABLE "escalation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"condition" text NOT NULL,
	"description" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "escalation_rules_condition_unique" UNIQUE("condition")
);
--> statement-breakpoint
CREATE TABLE "forecast_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"lat" real NOT NULL,
	"lon" real NOT NULL,
	"forecast_url" text NOT NULL,
	"api_url" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "forecast_zones_zone_id_unique" UNIQUE("zone_id"),
	CONSTRAINT "forecast_zones_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "snotel_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"triplet" text NOT NULL,
	"zone_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "snotel_stations_triplet_unique" UNIQUE("triplet")
);
--> statement-breakpoint
CREATE TABLE "snowpack_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_triplet" text NOT NULL,
	"date" text NOT NULL,
	"element_code" text NOT NULL,
	"value" real,
	"unit_code" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "snowpack_readings_station_triplet_date_element_code_unique" UNIQUE("station_triplet","date","element_code")
);
--> statement-breakpoint
CREATE TABLE "weather_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"period_number" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"temperature" integer,
	"temperature_unit" text,
	"short_forecast" text,
	"wind_speed" text,
	"wind_direction" text,
	"is_daytime" boolean,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "weather_readings_zone_id_start_time_unique" UNIQUE("zone_id","start_time")
);
