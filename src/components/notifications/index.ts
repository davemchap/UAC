import type postgres from "postgres";
import type { AlertAction } from "../alerts";
import { dispatchWebhook } from "./channels/webhook";
import type { Notification, NotificationInput } from "./types";

export type { Notification, NotificationInput } from "./types";

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function shouldNotify(action: AlertAction): boolean {
	return action !== "no_alert";
}

export function buildCooldownKey(zoneSlug: string, action: AlertAction): string {
	return `${zoneSlug}:${action}`;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function findRecentDuplicate(
	sql: ReturnType<typeof postgres>,
	cooldownKey: string,
	windowMinutes: number,
): Promise<boolean> {
	const rows = await sql<{ id: number }[]>`
		SELECT id FROM notifications
		WHERE cooldown_key = ${cooldownKey}
		  AND created_at > NOW() - (${windowMinutes} * INTERVAL '1 minute')
		LIMIT 1
	`;
	return rows.length > 0;
}

export async function insertNotification(
	sql: ReturnType<typeof postgres>,
	input: NotificationInput,
): Promise<Notification> {
	const cooldownKey = buildCooldownKey(input.zoneSlug, input.action);
	const rows = await sql<Notification[]>`
		INSERT INTO notifications
			(zone_slug, zone_name, danger_level, danger_name, action, label, escalated, escalation_reason, cooldown_key)
		VALUES
			(${input.zoneSlug}, ${input.zoneName}, ${input.dangerLevel}, ${input.dangerName},
			 ${input.action}, ${input.label}, ${input.escalated}, ${input.escalationReason ?? null}, ${cooldownKey})
		RETURNING *
	`;
	return rows[0];
}

export async function getNotifications(
	sql: ReturnType<typeof postgres>,
	opts: { zone?: string; limit?: number; acknowledged?: boolean } = {},
): Promise<Notification[]> {
	const limit = Math.min(opts.limit ?? 50, 200);
	const { zone, acknowledged } = opts;

	if (zone !== undefined && acknowledged !== undefined) {
		return sql<Notification[]>`
			SELECT * FROM notifications
			WHERE zone_slug = ${zone} AND acknowledged = ${acknowledged}
			ORDER BY created_at DESC LIMIT ${limit}
		`;
	}
	if (zone !== undefined) {
		return sql<Notification[]>`
			SELECT * FROM notifications
			WHERE zone_slug = ${zone}
			ORDER BY created_at DESC LIMIT ${limit}
		`;
	}
	if (acknowledged !== undefined) {
		return sql<Notification[]>`
			SELECT * FROM notifications
			WHERE acknowledged = ${acknowledged}
			ORDER BY created_at DESC LIMIT ${limit}
		`;
	}
	return sql<Notification[]>`
		SELECT * FROM notifications
		ORDER BY created_at DESC LIMIT ${limit}
	`;
}

export async function acknowledgeNotification(
	sql: ReturnType<typeof postgres>,
	id: number,
): Promise<Notification | null> {
	const rows = await sql<Notification[]>`
		UPDATE notifications
		SET acknowledged = true, acknowledged_at = NOW()
		WHERE id = ${id}
		RETURNING *
	`;
	return rows.length > 0 ? rows[0] : null;
}

async function updateWebhookStatus(sql: ReturnType<typeof postgres>, id: number, webhookStatus: string): Promise<void> {
	await sql`UPDATE notifications SET webhook_status = ${webhookStatus} WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

const DEFAULT_COOLDOWN_MINUTES = 360; // 6 hours

export async function evaluateAndCreate(
	sql: ReturnType<typeof postgres>,
	input: NotificationInput,
	cooldownMinutes = DEFAULT_COOLDOWN_MINUTES,
): Promise<Notification | null> {
	if (!shouldNotify(input.action)) return null;

	const cooldownKey = buildCooldownKey(input.zoneSlug, input.action);
	const isDuplicate = await findRecentDuplicate(sql, cooldownKey, cooldownMinutes);
	if (isDuplicate) return null;

	return insertNotification(sql, input);
}

export async function dispatchNotification(
	sql: ReturnType<typeof postgres>,
	notification: Notification,
): Promise<void> {
	const result = await dispatchWebhook(notification);
	const status = result.success ? `sent:${result.statusCode}` : `failed:${result.error ?? "unknown"}`;
	await updateWebhookStatus(sql, notification.id, status);
}
