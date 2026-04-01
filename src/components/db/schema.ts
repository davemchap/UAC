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
