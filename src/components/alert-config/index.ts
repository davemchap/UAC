import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type postgres from "postgres";
import type { AlertAction } from "../alerts";
import type { AlertConfig, AlertRule, ThresholdRow } from "./types";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

interface ThresholdEntry {
	danger_level: number;
	name: string;
	action: string;
}

function loadThresholdsFromJson(): ThresholdEntry[] {
	const filePath = resolve(process.cwd(), "data/black-diamond/alert-thresholds.json");
	const file = JSON.parse(readFileSync(filePath, "utf8")) as { alert_thresholds: ThresholdEntry[] };
	return file.alert_thresholds;
}

export async function seedThresholds(sql: ReturnType<typeof postgres>): Promise<void> {
	const existing = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM alert_thresholds`;
	if (Number(existing[0].count) > 0) return;

	const entries = loadThresholdsFromJson();
	for (const entry of entries) {
		await sql`
			INSERT INTO alert_thresholds (danger_level, danger_name, action)
			VALUES (${entry.danger_level}, ${entry.name}, ${entry.action})
			ON CONFLICT (danger_level) DO NOTHING
		`;
	}
	console.log(`Seeded ${entries.length} alert thresholds from JSON`);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function loadAlertConfig(sql: ReturnType<typeof postgres>): Promise<AlertConfig> {
	const [thresholds, rules] = await Promise.all([
		sql<ThresholdRow[]>`SELECT * FROM alert_thresholds ORDER BY danger_level`,
		sql<AlertRule[]>`SELECT * FROM alert_rules WHERE enabled = true ORDER BY priority DESC, id ASC`,
	]);
	return { thresholds, rules };
}

export async function upsertThresholds(
	sql: ReturnType<typeof postgres>,
	rows: { dangerLevel: number; action: AlertAction }[],
): Promise<void> {
	for (const row of rows) {
		await sql`
			UPDATE alert_thresholds
			SET action = ${row.action}, updated_at = now()
			WHERE danger_level = ${row.dangerLevel}
		`;
	}
}

export async function createRule(
	sql: ReturnType<typeof postgres>,
	input: {
		name: string;
		minDangerLevel?: number | null;
		minProblemCount?: number | null;
		zoneSlug?: string | null;
		action: AlertAction;
		priority?: number;
		enabled?: boolean;
	},
): Promise<AlertRule> {
	const rows = await sql<AlertRule[]>`
		INSERT INTO alert_rules (name, min_danger_level, min_problem_count, zone_slug, action, priority, enabled)
		VALUES (
			${input.name},
			${input.minDangerLevel ?? null},
			${input.minProblemCount ?? null},
			${input.zoneSlug ?? null},
			${input.action},
			${input.priority ?? 0},
			${input.enabled ?? true}
		)
		RETURNING *
	`;
	return rows[0];
}

export async function updateRule(
	sql: ReturnType<typeof postgres>,
	id: number,
	input: Partial<{
		name: string;
		minDangerLevel: number | null;
		minProblemCount: number | null;
		zoneSlug: string | null;
		action: AlertAction;
		priority: number;
		enabled: boolean;
	}>,
): Promise<AlertRule | null> {
	// Fetch current state first so we can merge only the provided fields
	const current = await sql<AlertRule[]>`SELECT * FROM alert_rules WHERE id = ${id}`;
	if (current.length === 0) return null;
	const c = current[0];

	const rows = await sql<AlertRule[]>`
		UPDATE alert_rules SET
			name              = ${input.name ?? c.name},
			min_danger_level  = ${input.minDangerLevel !== undefined ? input.minDangerLevel : c.minDangerLevel},
			min_problem_count = ${input.minProblemCount !== undefined ? input.minProblemCount : c.minProblemCount},
			zone_slug         = ${input.zoneSlug !== undefined ? input.zoneSlug : c.zoneSlug},
			action            = ${input.action ?? c.action},
			priority          = ${input.priority ?? c.priority},
			enabled           = ${input.enabled ?? c.enabled}
		WHERE id = ${id}
		RETURNING *
	`;
	return rows.length > 0 ? rows[0] : null;
}

export async function deleteRule(sql: ReturnType<typeof postgres>, id: number): Promise<boolean> {
	const rows = await sql<{ id: number }[]>`DELETE FROM alert_rules WHERE id = ${id} RETURNING id`;
	return rows.length > 0;
}

export async function getAllRules(sql: ReturnType<typeof postgres>): Promise<AlertRule[]> {
	return sql<AlertRule[]>`SELECT * FROM alert_rules ORDER BY priority DESC, id ASC`;
}
