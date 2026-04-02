import { boolean, integer, pgTable, real, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const forecastZones = pgTable("forecast_zones", {
	id: serial("id").primaryKey(),
	zoneId: integer("zone_id").unique().notNull(),
	name: text("name").notNull(),
	slug: text("slug").unique().notNull(),
	lat: real("lat").notNull(),
	lon: real("lon").notNull(),
	forecastUrl: text("forecast_url").notNull(),
	apiUrl: text("api_url").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

export const snotelStations = pgTable("snotel_stations", {
	id: serial("id").primaryKey(),
	triplet: text("triplet").unique().notNull(),
	zoneId: integer("zone_id").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

export const avalancheForecasts = pgTable(
	"avalanche_forecasts",
	{
		id: serial("id").primaryKey(),
		zoneId: integer("zone_id").notNull(),
		nid: text("nid").notNull(),
		dateIssued: text("date_issued").notNull(),
		dateIssuedTimestamp: text("date_issued_timestamp"),
		overallDangerRating: text("overall_danger_rating").notNull(),
		avalancheProblem1: text("avalanche_problem_1"),
		avalancheProblem2: text("avalanche_problem_2"),
		avalancheProblem3: text("avalanche_problem_3"),
		bottomLine: text("bottom_line"),
		currentConditions: text("current_conditions"),
		region: text("region"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(t) => [unique().on(t.zoneId, t.nid)],
);

export const avalancheProblems = pgTable(
	"avalanche_problems",
	{
		id: serial("id").primaryKey(),
		forecastId: integer("forecast_id").notNull(),
		problemNumber: integer("problem_number").notNull(),
		problemType: text("problem_type").notNull(),
		description: text("description"),
		dangerRose: text("danger_rose"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [unique().on(t.forecastId, t.problemNumber)],
);

export const weatherReadings = pgTable(
	"weather_readings",
	{
		id: serial("id").primaryKey(),
		zoneId: integer("zone_id").notNull(),
		periodNumber: integer("period_number").notNull(),
		startTime: text("start_time").notNull(),
		endTime: text("end_time"),
		temperature: integer("temperature"),
		temperatureUnit: text("temperature_unit"),
		shortForecast: text("short_forecast"),
		windSpeed: text("wind_speed"),
		windDirection: text("wind_direction"),
		isDaytime: boolean("is_daytime"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [unique().on(t.zoneId, t.startTime)],
);

export const snowpackReadings = pgTable(
	"snowpack_readings",
	{
		id: serial("id").primaryKey(),
		stationTriplet: text("station_triplet").notNull(),
		date: text("date").notNull(),
		elementCode: text("element_code").notNull(),
		value: real("value"),
		unitCode: text("unit_code"),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [unique().on(t.stationTriplet, t.date, t.elementCode)],
);

export const alertThresholds = pgTable("alert_thresholds", {
	id: serial("id").primaryKey(),
	dangerLevel: integer("danger_level").unique().notNull(),
	name: text("name").notNull(),
	action: text("action").notNull(),
	description: text("description"),
});

export const escalationRules = pgTable("escalation_rules", {
	id: serial("id").primaryKey(),
	condition: text("condition").unique().notNull(),
	description: text("description").notNull(),
	action: text("action").notNull(),
});

export const fieldObservations = pgTable("field_observations", {
	id: serial("id").primaryKey(),
	observerName: text("observer_name").notNull(),
	observerEmail: text("observer_email").notNull(),
	experienceLevel: text("experience_level").notNull(),
	zoneSlug: text("zone_slug").notNull(),
	areaName: text("area_name"),
	aspect: text("aspect"),
	elevationFt: integer("elevation_ft"),
	observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
	obsTypes: text("obs_types").array().notNull(),
	avalancheType: text("avalanche_type"),
	trigger: text("trigger"),
	sizeR: integer("size_r"),
	sizeD: integer("size_d"),
	widthFt: integer("width_ft"),
	verticalFt: integer("vertical_ft"),
	depthIn: integer("depth_in"),
	surfaceConditions: text("surface_conditions"),
	snowDepthIn: integer("snow_depth_in"),
	stormSnowIn: integer("storm_snow_in"),
	weakLayers: boolean("weak_layers"),
	weakLayersDesc: text("weak_layers_desc"),
	skyCover: text("sky_cover"),
	windSpeed: text("wind_speed"),
	windDirection: text("wind_direction"),
	temperatureF: integer("temperature_f"),
	precip: text("precip"),
	fieldNotes: text("field_notes"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const morningBriefings = pgTable(
	"morning_briefings",
	{
		id: serial("id").primaryKey(),
		zoneId: integer("zone_id").notNull(),
		zoneSlug: text("zone_slug").notNull(),
		briefingDate: text("briefing_date").notNull(), // YYYY-MM-DD
		dangerRating: text("danger_rating"),
		dangerLevel: integer("danger_level"),
		dangerAboveTreelineRating: text("danger_above_treeline_rating"),
		dangerAboveTreelineLevel: integer("danger_above_treeline_level"),
		dangerNearTreelineRating: text("danger_near_treeline_rating"),
		dangerNearTreelineLevel: integer("danger_near_treeline_level"),
		dangerBelowTreelineRating: text("danger_below_treeline_rating"),
		dangerBelowTreelineLevel: integer("danger_below_treeline_level"),
		avalancheProblems: text("avalanche_problems").array(),
		alertAction: text("alert_action").notNull(),
		explanation: text("explanation"),
		model: text("model"),
		status: text("status").notNull().default("ready"), // ready | no_alert | briefing_failed
		reviewStatus: text("review_status"), // approved | edited | rejected
		reviewerName: text("reviewer_name"),
		reviewedAt: timestamp("reviewed_at"),
		originalExplanation: text("original_explanation"),
		reviewerNotes: text("reviewer_notes"),
		generatedAt: timestamp("generated_at").defaultNow(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [unique().on(t.zoneId, t.briefingDate)],
);

export const aiAlerts = pgTable(
	"ai_alerts",
	{
		id: serial("id").primaryKey(),
		zoneId: integer("zone_id").notNull(),
		dangerRating: text("danger_rating").notNull(),
		dangerLevel: integer("danger_level").notNull(),
		dangerAboveTreelineRating: text("danger_above_treeline_rating").notNull(),
		dangerAboveTreelineLevel: integer("danger_above_treeline_level").notNull(),
		dangerNearTreelineRating: text("danger_near_treeline_rating").notNull(),
		dangerNearTreelineLevel: integer("danger_near_treeline_level").notNull(),
		dangerBelowTreelineRating: text("danger_below_treeline_rating").notNull(),
		dangerBelowTreelineLevel: integer("danger_below_treeline_level").notNull(),
		avalancheProblems: text("avalanche_problems").array().notNull(),
		alertAction: text("alert_action").notNull(),
		alertReasoning: text("alert_reasoning").notNull(),
		backcountrySummary: text("backcountry_summary").notNull(),
		model: text("model").notNull(),
		forecastNid: text("forecast_nid").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [unique().on(t.zoneId, t.forecastNid)],
);
