import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { checkDatabaseHealth, initializeDatabase } from "../../components/db";
import { seedHistoricalData, seedReferenceData, seedSnapshotData } from "../../components/db/seed-reference";
import { startScheduler } from "../../components/ingestion";
import { startScorecardScheduler } from "../../components/scorecard-scheduler";
import personasRoute from "./routes/personas";
import scorecard from "./routes/scorecard";

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
		message: "UAC Avalanche Scorecard API",
		version: "1.0.0",
		endpoints: {
			health: "GET /health",
			personas: "GET /api/personas",
			scorecard: {
				run: "POST /api/scorecard/run",
				history: "GET /api/scorecard/history",
			},
		},
	}),
);

app.route("/api/personas", personasRoute);
app.route("/api/scorecard", scorecard);

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

const INDEX_HTML = "/index.html";

app.use(
	"/scorecard/*",
	serveStatic({
		root: "./src/projects/scorecard",
		rewriteRequestPath: (path) => path.replace(/^\/scorecard/, "") || INDEX_HTML,
	}),
);

app.get("/scorecard", (c) => c.redirect("/scorecard/"));

// Public landing page — no auth required
app.use(
	"/",
	serveStatic({
		root: "./src/projects/public",
		rewriteRequestPath: () => INDEX_HTML,
	}),
);

// Redirect all unmatched non-API paths to the scorecard
app.get("/*", (c) => {
	if (!c.req.path.startsWith("/api") && !c.req.path.includes(".")) {
		return c.redirect("/scorecard/");
	}
	return c.notFound();
});

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
		await seedSnapshotData();
		await seedHistoricalData();
	} catch (error) {
		console.error("Failed to initialize database:", error);
		console.log("Continuing without database...");
	}
	_stopScheduler = startScheduler();
	startScorecardScheduler();
}

export function stopScheduler(): void {
	_stopScheduler?.();
	_stopScheduler = null;
}
