import { describe, expect, test } from "bun:test";
import { generateAlert } from "../components/alerts";
import type { AlertConfig } from "../components/alert-config/types";
import type { RiskAssessment } from "../components/risk-assessment";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
	return {
		dangerLevel: 3,
		dangerName: "Considerable",
		problemCount: 1,
		problems: ["Wind Slab"],
		hasDataGap: false,
		bottomLine: "",
		currentTemp: null,
		tempUnit: "F",
		snowDepthIn: null,
		...overrides,
	};
}

const BASE_CONFIG: AlertConfig = {
	thresholds: [
		{ dangerLevel: 1, dangerName: "Low", action: "no_alert", updatedAt: new Date() },
		{ dangerLevel: 2, dangerName: "Moderate", action: "no_alert", updatedAt: new Date() },
		{ dangerLevel: 3, dangerName: "Considerable", action: "human_review", updatedAt: new Date() },
		{ dangerLevel: 4, dangerName: "High", action: "auto_send", updatedAt: new Date() },
		{ dangerLevel: 5, dangerName: "Extreme", action: "auto_send_urgent", updatedAt: new Date() },
	],
	rules: [],
};

// ---------------------------------------------------------------------------
// generateAlert with DB config
// ---------------------------------------------------------------------------

describe("generateAlert — DB config thresholds", () => {
	test("uses DB thresholds instead of JSON file", () => {
		// Override Considerable → auto_send in DB
		const config: AlertConfig = {
			...BASE_CONFIG,
			thresholds: BASE_CONFIG.thresholds.map((t) => (t.dangerLevel === 3 ? { ...t, action: "auto_send" as const } : t)),
		};
		const result = generateAlert(makeAssessment({ dangerLevel: 3, problemCount: 1 }), config);
		expect(result.action).toBe("auto_send");
	});

	test("falls back to no_alert for unknown danger level", () => {
		const result = generateAlert(makeAssessment({ dangerLevel: 0, problemCount: 0 }), BASE_CONFIG);
		expect(result.action).toBe("no_alert");
	});

	test("escalation still applies on top of DB threshold", () => {
		// Moderate → no_alert, but 2 problems should escalate to human_review
		const result = generateAlert(makeAssessment({ dangerLevel: 2, problemCount: 2 }), BASE_CONFIG);
		expect(result.action).toBe("human_review");
		expect(result.escalated).toBe(true);
	});

	test("data gap overrides DB threshold", () => {
		const result = generateAlert(makeAssessment({ dangerLevel: 5, hasDataGap: true }), BASE_CONFIG);
		expect(result.action).toBe("flag_for_review");
	});
});

describe("generateAlert — advanced rules", () => {
	test("matching rule overrides threshold", () => {
		const config: AlertConfig = {
			...BASE_CONFIG,
			rules: [
				{
					id: 1,
					name: "test",
					enabled: true,
					priority: 0,
					minDangerLevel: 2,
					minProblemCount: null,
					zoneSlug: null,
					action: "auto_send_urgent",
					createdAt: new Date(),
				},
			],
		};
		// Danger level 2, no problems — threshold would be no_alert, but rule fires
		const result = generateAlert(makeAssessment({ dangerLevel: 2, problemCount: 0 }), config);
		expect(result.action).toBe("auto_send_urgent");
	});

	test("zone-specific rule only fires for matching slug", () => {
		const config: AlertConfig = {
			...BASE_CONFIG,
			rules: [
				{
					id: 1,
					name: "salt lake only",
					enabled: true,
					priority: 0,
					minDangerLevel: 1,
					minProblemCount: null,
					zoneSlug: "salt-lake",
					action: "auto_send_urgent",
					createdAt: new Date(),
				},
			],
		};
		const saltLake = generateAlert(makeAssessment({ dangerLevel: 1 }), config, "salt-lake");
		const ogden = generateAlert(makeAssessment({ dangerLevel: 1 }), config, "ogden");
		expect(saltLake.action).toBe("auto_send_urgent");
		expect(ogden.action).toBe("no_alert"); // threshold for level 1
	});

	test("disabled rules are skipped", () => {
		const config: AlertConfig = {
			...BASE_CONFIG,
			rules: [
				{
					id: 1,
					name: "disabled",
					enabled: false,
					priority: 0,
					minDangerLevel: 1,
					minProblemCount: null,
					zoneSlug: null,
					action: "auto_send_urgent",
					createdAt: new Date(),
				},
			],
		};
		const result = generateAlert(makeAssessment({ dangerLevel: 1 }), config);
		expect(result.action).toBe("no_alert"); // falls through to threshold
	});

	test("higher priority rule wins over lower priority", () => {
		const config: AlertConfig = {
			...BASE_CONFIG,
			rules: [
				{
					id: 1,
					name: "low priority",
					enabled: true,
					priority: 0,
					minDangerLevel: 2,
					minProblemCount: null,
					zoneSlug: null,
					action: "human_review",
					createdAt: new Date(),
				},
				{
					id: 2,
					name: "high priority",
					enabled: true,
					priority: 10,
					minDangerLevel: 2,
					minProblemCount: null,
					zoneSlug: null,
					action: "auto_send_urgent",
					createdAt: new Date(),
				},
			],
		};
		// Config rules are already sorted priority DESC — simulate that
		const sortedConfig: AlertConfig = {
			...config,
			rules: [...config.rules].sort((a, b) => b.priority - a.priority),
		};
		const result = generateAlert(makeAssessment({ dangerLevel: 2 }), sortedConfig);
		expect(result.action).toBe("auto_send_urgent");
	});

	test("problem count condition works", () => {
		const config: AlertConfig = {
			...BASE_CONFIG,
			rules: [
				{
					id: 1,
					name: "multi-problem",
					enabled: true,
					priority: 0,
					minDangerLevel: null,
					minProblemCount: 2,
					zoneSlug: null,
					action: "auto_send",
					createdAt: new Date(),
				},
			],
		};
		const single = generateAlert(makeAssessment({ dangerLevel: 1, problemCount: 1 }), config);
		const multi = generateAlert(makeAssessment({ dangerLevel: 1, problemCount: 2 }), config);
		// Single problem: rule doesn't match, falls to threshold (no_alert), no escalation
		expect(single.action).toBe("no_alert");
		// Multi problem: rule matches → auto_send (escalation would be: auto_send → auto_send_urgent, but rule sets baseAction directly)
		// Note: escalation still applies on top of rule action since problemCount >= 2
		expect(multi.action).toBe("auto_send_urgent"); // auto_send escalated by multi-problem rule
	});
});

describe("generateAlert — no config (JSON fallback)", () => {
	test("works without config param", () => {
		// Ensures eval tests and existing code paths still work
		const result = generateAlert(makeAssessment({ dangerLevel: 3, problemCount: 1 }));
		expect(result.action).toBe("human_review");
		expect(result.dangerLevel).toBe(3);
	});
});
