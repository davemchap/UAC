import type { AlertAction } from "../alerts";

export interface Notification {
	id: number;
	zoneSlug: string;
	zoneName: string;
	dangerLevel: number;
	dangerName: string;
	action: AlertAction;
	label: string;
	escalated: boolean;
	escalationReason: string | null;
	status: string;
	webhookStatus: string | null;
	acknowledged: boolean;
	acknowledgedAt: Date | null;
	cooldownKey: string;
	createdAt: Date;
}

export interface NotificationInput {
	zoneSlug: string;
	zoneName: string;
	dangerLevel: number;
	dangerName: string;
	action: AlertAction;
	label: string;
	escalated: boolean;
	escalationReason: string | null;
}
