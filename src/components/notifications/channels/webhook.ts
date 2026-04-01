import type { Notification } from "../types";

export interface WebhookResult {
	success: boolean;
	statusCode: number;
	error?: string;
}

const WEBHOOK_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Slack formatting helpers
// ---------------------------------------------------------------------------

const DANGER_COLOR: Record<number, string> = {
	1: "#4ade80",
	2: "#facc15",
	3: "#fb923c",
	4: "#f87171",
	5: "#dc2626",
};

const DANGER_EMOJI: Record<number, string> = {
	1: "🟢",
	2: "🟡",
	3: "🟠",
	4: "🔴",
	5: "⛔",
};

const ACTION_EMOJI: Record<string, string> = {
	human_review: "⚠️",
	auto_send: "🚨",
	auto_send_urgent: "🆘",
	flag_for_review: "🚩",
};

function buildSlackPayload(notification: Notification): string {
	const dangerEmoji = DANGER_EMOJI[notification.dangerLevel] ?? "❓";
	const actionEmoji = ACTION_EMOJI[notification.action] ?? "📣";
	const color = DANGER_COLOR[notification.dangerLevel] ?? "#6b7280";

	const fields = [
		{
			type: "mrkdwn",
			text: `*Danger Level*\n${dangerEmoji} ${notification.dangerLevel} – ${notification.dangerName}`,
		},
		{
			type: "mrkdwn",
			text: `*Action*\n${actionEmoji} ${notification.label}`,
		},
	];

	if (notification.escalated && notification.escalationReason) {
		fields.push({
			type: "mrkdwn",
			text: `*Escalation*\n⬆️ ${notification.escalationReason}`,
		});
	}

	const timestamp = new Date(notification.createdAt).toUTCString();

	return JSON.stringify({
		attachments: [
			{
				color,
				blocks: [
					{
						type: "header",
						text: {
							type: "plain_text",
							text: `🏔️ Zone Alert: ${notification.zoneName}`,
							emoji: true,
						},
					},
					{
						type: "section",
						fields,
					},
					{
						type: "divider",
					},
					{
						type: "context",
						elements: [
							{
								type: "mrkdwn",
								text: `🕐 ${timestamp} · Utah Avalanche Center`,
							},
						],
					},
				],
			},
		],
	});
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

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

	const body = buildSlackPayload(notification);

	const first = await attempt(webhookUrl, body, fetchFn);
	if (first.success) return first;

	// One retry after 2 seconds
	await new Promise<void>((resolve) => setTimeout(resolve, 2000));
	return attempt(webhookUrl, body, fetchFn);
}
