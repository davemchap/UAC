import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { checkDatabaseHealth, initializeDatabase } from "../../components/db";
import { seedReferenceData } from "../../components/db/seed-reference";
import { startScheduler } from "../../components/ingestion";
import aiAlerts from "./routes/ai-alerts";
import alertConfig from "./routes/alert-config";
import notifications from "./routes/notifications";
import observations from "./routes/observations";
import proxy from "./routes/proxy";
import reports from "./routes/reports";
import reviews from "./routes/reviews";
import zones from "./routes/zones";
import map from "./routes/map";
import { getZoneBoundaries } from "../../components/zone-lookup";

export const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(
	"/api/*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

app.use("*", logger());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check — required for ECS/ALB. DO NOT REMOVE. */
app.get("/health", async (c) => {
	const dbHealthy = await checkDatabaseHealth();

	return c.json(
		{
			status: dbHealthy ? "healthy" : "degraded",
			timestamp: new Date().toISOString(),
			version: process.env.npm_package_version ?? "1.0.0",
			checks: { database: dbHealthy ? "connected" : "disconnected" },
		},
		dbHealthy ? 200 : 503,
	);
});

app.get("/api", (c) =>
	c.json({
		message: "Utah Avalanche Forecast Analysis & Alerting Engine",
		version: "1.0.0",
		endpoints: {
			health: "GET /health",
			zones: {
				allZones: "GET /api/zones",
				zoneDetail: "GET /api/zones/:slug",
			},
			notifications: {
				list: "GET /api/notifications",
				acknowledge: "POST /api/notifications/:id/acknowledge",
			},
			proxy: {
				avalancheForecast: "GET /api/proxy/avalanche/forecast?zone=<zone_id>",
				avalancheZones: "GET /api/proxy/avalanche/zones",
				snotelStation: "GET /api/proxy/snotel/station/:triplet",
			},
		},
	}),
);

app.route("/api/zones", zones);
app.route("/api/ai-alerts", aiAlerts);
app.route("/api/notifications", notifications);
app.route("/api/observations", observations);
app.route("/api/reports", reports);
app.route("/api/reviews", reviews);
app.route("/api/alert-config", alertConfig);
app.route("/api/proxy", proxy);
app.route("/api", map);

app.get("/api/zone-boundaries", (c) => c.json(getZoneBoundaries()));

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

app.use(
	"/command-center/*",
	serveStatic({
		root: "./src/projects/command-center",
		rewriteRequestPath: (path) => path.replace(/^\/command-center/, "") || "/index.html",
	}),
);

// Public landing page — no auth required
app.use(
	"/",
	serveStatic({
		root: "./src/projects/public",
		rewriteRequestPath: () => "/index.html",
	}),
);

app.use(
	"/dashboard/*",
	serveStatic({
		root: "./src/projects/dashboard",
		rewriteRequestPath: (path) => {
			const stripped = path.replace(/^\/dashboard/, "") || "/";
			if (stripped === "/observe") return "/observe.html";
			if (stripped === "/report") return "/report.html";
			if (stripped === "/" || (!stripped.includes(".") && !stripped.startsWith("/api"))) {
				return "/index.html";
			}
			return stripped;
		},
	}),
);

app.use(
	"/*",
	serveStatic({
		root: "./src/projects/dashboard",
		rewriteRequestPath: (path) => {
			if (path === "/observe") return "/observe.html";
			if (path === "/report") return "/report.html";
			if (!path.includes(".") && !path.startsWith("/api")) {
				return "/index.html";
			}
			return path;
		},
	}),
);

// ---------------------------------------------------------------------------
// 404 / error handlers
// ---------------------------------------------------------------------------

app.notFound((c) => {
	if (c.req.path.startsWith("/api")) {
		return c.json(
			{ success: false, error: "Not found", message: `API route ${c.req.method} ${c.req.path} does not exist` },
			404,
		);
	}

	return c.html(
		`<!DOCTYPE html><html><head><title>404 - Not Found</title></head><body>
<h1>404 - Page Not Found</h1><p><a href="/">Go back home</a></p></body></html>`,
		404,
	);
});

app.onError((err, c) => {
	console.error("Unhandled error:", err);

	if (c.req.path.startsWith("/api")) {
		return c.json(
			{
				success: false,
				error: "Internal server error",
				message: process.env.NODE_ENV === "development" ? err.message : undefined,
			},
			500,
		);
	}

	return c.html(
		`<!DOCTYPE html><html><head><title>500 - Server Error</title></head><body>
<h1>500 - Server Error</h1><p>Something went wrong. Please try again later.</p></body></html>`,
		500,
	);
});

// ---------------------------------------------------------------------------
// Init / teardown (called by the server entry point)
// ---------------------------------------------------------------------------

let _stopScheduler: (() => void) | null = null;

export async function initApp(): Promise<void> {
	try {
		await initializeDatabase();
		await seedReferenceData();
	} catch (error) {
		console.error("Failed to initialize database:", error);
		console.log("Continuing without database...");
	}
	_stopScheduler = startScheduler();
}

export function stopScheduler(): void {
	_stopScheduler?.();
	_stopScheduler = null;
}
