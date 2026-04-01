export interface ProxySuccess {
	source: "live";
	data: unknown;
}

export interface ProxyFailure {
	source: "cache";
	data: null;
	error: string;
}

export type ProxyResponse = ProxySuccess | ProxyFailure;

export const EXTERNAL_API_UNAVAILABLE = "external API unavailable";

export const unavailable: ProxyFailure = {
	source: "cache",
	data: null,
	error: EXTERNAL_API_UNAVAILABLE,
};

export async function fetchJson(url: string): Promise<ProxyResponse> {
	try {
		const response = await fetch(url, {
			headers: {
				Accept: "application/json",
				"User-Agent": "ShipSummit-Proxy/1.0",
			},
		});

		if (!response.ok) {
			console.error(`Proxy upstream error: ${response.status} ${response.statusText} — ${url}`);
			return unavailable;
		}

		const data: unknown = await response.json();
		return { source: "live", data };
	} catch (error) {
		console.error(`Proxy fetch error for ${url}:`, error);
		return unavailable;
	}
}
