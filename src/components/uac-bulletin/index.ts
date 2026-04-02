// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BulletinType = "warning" | "watch" | "none";

export interface ActiveBulletin {
	type: BulletinType;
	effectivePeriod: string | null;
	coverageArea: string | null;
	lifeSafetyMessage: string;
	rawText: string;
}

// ---------------------------------------------------------------------------
// Life-safety messages
// ---------------------------------------------------------------------------

const LIFE_SAFETY: Record<Exclude<BulletinType, "none">, string> = {
	warning: "Very dangerous avalanche conditions exist — avoid all avalanche terrain.",
	watch: "Dangerous avalanche conditions are developing — be prepared to alter or cancel your plans.",
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

export function detectBulletinType(text: string | null | undefined): BulletinType {
	if (!text) return "none";
	const lower = text.toLowerCase();
	if (lower.includes("warning")) return "warning";
	if (lower.includes("watch")) return "watch";
	return "none";
}

function extractField(text: string, label: string): string | null {
	const pattern = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
	const match = pattern.exec(text);
	return match?.[1]?.trim() ?? null;
}

export function parseBulletin(text: string | null | undefined): ActiveBulletin | null {
	const type = detectBulletinType(text);
	if (type === "none" || !text) return null;

	return {
		type,
		effectivePeriod: extractField(text, "When") ?? extractField(text, "Warning Times"),
		coverageArea: extractField(text, "Where"),
		lifeSafetyMessage: LIFE_SAFETY[type],
		rawText: text,
	};
}
