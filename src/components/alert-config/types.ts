export type AlertAction = "no_alert" | "human_review" | "auto_send" | "auto_send_urgent" | "flag_for_review";

export interface ThresholdRow {
	dangerLevel: number;
	dangerName: string;
	action: AlertAction;
	updatedAt: Date;
}

export interface AlertRule {
	id: number;
	name: string;
	minDangerLevel: number | null;
	minProblemCount: number | null;
	zoneSlug: string | null;
	action: AlertAction;
	priority: number;
	enabled: boolean;
	createdAt: Date;
}

export interface AlertConfig {
	thresholds: ThresholdRow[];
	rules: AlertRule[];
}
