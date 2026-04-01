import type { Notification } from "../types";

export interface WebhookResult {
	success: boolean;
	statusCode: number;
	error?: string;
}

const WEBHOOK_TIMEOUT_MS = 5000;

async function attempt(url: string, body: string, fetchFn: typeof fetch): Promise<WebhookResult> {
	const controller = new AbortController();
	const timeout = setTimeout(() => {
		controller.abort();
	}, WEBHOOK_TIMEOUT_MS);
	try {
		const res = await fetchFn(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			signal: controller.signal,
		});
		return { success: res.ok, statusCode: res.status };
	} catch (err) {
		return { success: false, statusCode: 0, error: err instanceof Error ? err.message : "unknown" };
	} finally {
		clearTimeout(timeout);
	}
}

export async function dispatchWebhook(
	notification: Notification,
	fetchFn: typeof fetch = fetch,
): Promise<WebhookResult> {
	const webhookUrl = process.env.WEBHOOK_URL;

	if (!webhookUrl) {
		return { success: true, statusCode: 0 };
	}

	const body = JSON.stringify({
		event: "zone_alert",
		notification: {
			id: notification.id,
			zoneSlug: notification.zoneSlug,
			zoneName: notification.zoneName,
			dangerLevel: notification.dangerLevel,
			dangerName: notification.dangerName,
			action: notification.action,
			label: notification.label,
			escalated: notification.escalated,
			escalationReason: notification.escalationReason,
			createdAt: notification.createdAt,
		},
	});

	const first = await attempt(webhookUrl, body, fetchFn);
	if (first.success) return first;

	// One retry after 2 seconds
	await new Promise<void>((resolve) => setTimeout(resolve, 2000));
	return attempt(webhookUrl, body, fetchFn);
}
