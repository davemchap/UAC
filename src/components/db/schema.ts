import { boolean, integer, pgTable, real, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const personas = pgTable("personas", {
	id: serial("id").primaryKey(),
	personaKey: text("persona_key").unique().notNull(),
	name: text("name").notNull(),
	role: text("role").notNull(),
	color: text("color").notNull(),
	literacyLevel: text("literacy_level").notNull(),
	unknownTerms: text("unknown_terms").array().notNull().default([]),
	maxSentenceLength: integer("max_sentence_length").notNull(),
	maxGradeLevel: real("max_grade_level").notNull(),
	successCriteria: text("success_criteria").notNull(),
	behavioralContext: text("behavioral_context"),
	// Domain dimensions (avalanche-specific)
	yearsOfMountainExperience: integer("years_of_mountain_experience").notNull().default(0),
	avalancheTrainingLevel: integer("avalanche_training_level").notNull().default(0), // 0=None,1=Awareness,2=AIARE1,3=AIARE2,4=Pro
	backcountryDaysPerSeason: integer("backcountry_days_per_season").notNull().default(0),
	weatherPatternRecognition: integer("weather_pattern_recognition").notNull().default(1), // 1-5
	terrainAssessmentSkill: integer("terrain_assessment_skill").notNull().default(1), // 1-5
	groupDecisionTendency: integer("group_decision_tendency").notNull().default(3), // 1-5
	riskTolerance: integer("risk_tolerance").notNull().default(3), // 1-5
	localTerrainFamiliarity: integer("local_terrain_familiarity").notNull().default(1), // 1-5
	// Travel mode: human-powered | motorized | out-of-bounds
	travelMode: text("travel_mode").notNull().default("human-powered"),
	// Persona management
	active: boolean("active").notNull().default(true),
	tags: text("tags").array().notNull().default([]),
	isBuiltIn: boolean("is_built_in").notNull().default(false),
	// Avatar
	avatarSeed: text("avatar_seed"),
	avatarStyle: text("avatar_style").notNull().default("avataaars"),
	updatedAt: timestamp("updated_at").defaultNow(),
	createdAt: timestamp("created_at").defaultNow(),
});

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
		overallDangerRose: text("overall_danger_rose"),
		avalancheProblem1: text("avalanche_problem_1"),
		avalancheProblem2: text("avalanche_problem_2"),
		avalancheProblem3: text("avalanche_problem_3"),
		bottomLine: text("bottom_line"),
		currentConditions: text("current_conditions"),
		region: text("region"),
		forecasterName: text("forecaster_name"),
		specialBulletin: text("special_bulletin"),
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
		status: text("status").notNull().default("pending"),
		sentAt: timestamp("sent_at"),
		updatedAt: timestamp("updated_at").defaultNow(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(t) => [unique().on(t.zoneId, t.forecastNid)],
);

export const observationReports = pgTable("observation_reports", {
	id: serial("id").primaryKey(),
	handle: text("handle"),
	contentText: text("content_text"),
	contentImageUrl: text("content_image_url"),
	lat: real("lat"),
	lng: real("lng"),
	status: text("status").notNull().default("pending"),
	rejectionReason: text("rejection_reason"),
	aiSummary: text("ai_summary"),
	zoneSlug: text("zone_slug"),
	hazardType: text("hazard_type"),
	severity: text("severity"),
	locationDescription: text("location_description"),
	impactCount: integer("impact_count").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const alertReviews = pgTable("alert_reviews", {
	id: serial("id").primaryKey(),
	notificationId: integer("notification_id").notNull(),
	zoneSlug: text("zone_slug").notNull(),
	dangerLevel: integer("danger_level").notNull(),
	aiAlertId: integer("ai_alert_id"),
	originalText: text("original_text").notNull(),
	editedText: text("edited_text"),
	decision: text("decision").notNull(), // 'approved' | 'edited' | 'rejected'
	rejectionReason: text("rejection_reason"),
	reviewerUsername: text("reviewer_username").notNull(),
	reviewerRole: text("reviewer_role").notNull(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow(),
});

export const observerHandles = pgTable("observer_handles", {
	id: serial("id").primaryKey(),
	handle: text("handle").unique().notNull(),
	totalImpactPoints: integer("total_impact_points").notNull().default(0),
	badgeLevel: text("badge_level").notNull().default("scout"),
	rewardTriggered: boolean("reward_triggered").notNull().default(false),
	observationCount: integer("observation_count").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const scorecardRuns = pgTable(
	"scorecard_runs",
	{
		id: serial("id").primaryKey(),
		forecastId: integer("forecast_id").notNull(),
		zoneId: integer("zone_id").notNull(),
		zoneSlug: text("zone_slug").notNull(),
		zoneName: text("zone_name").notNull(),
		forecasterName: text("forecaster_name"),
		dateIssued: text("date_issued").notNull(),
		overallDangerRating: text("overall_danger_rating"),
		personaId: text("persona_id").notNull(),
		personaName: text("persona_name").notNull(),
		overallScore: integer("overall_score"),
		clarityScore: integer("clarity_score"),
		jargonScore: integer("jargon_score"),
		actionabilityScore: integer("actionability_score"),
		comprehensionLevel: text("comprehension_level"),
		divergenceScore: integer("divergence_score"),
		decisionConfidence: text("decision_confidence"),
		assumptionDensity: integer("assumption_density"),
		scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique().on(t.forecastId, t.personaId)],
);
