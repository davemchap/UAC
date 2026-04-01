import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { checkDatabaseHealth, initializeDatabase } from "../../components/db";
import proxy from "./routes/proxy";

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
		message: "Ship Summit Fullstack App API",
		version: "1.0.0",
		endpoints: {
			health: "GET /health",
			proxy: {
				avalancheForecast: "GET /api/proxy/avalanche/forecast?zone=<zone_id>",
				avalancheZones: "GET /api/proxy/avalanche/zones",
				snotelStation: "GET /api/proxy/snotel/station/:triplet",
			},
		},
	}),
);

app.route("/api/proxy", proxy);

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

app.use(
	"/*",
	serveStatic({
		root: "./src/public",
		rewriteRequestPath: (path) => {
			if (path === "/" || (!path.includes(".") && !path.startsWith("/api"))) {
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
// Init (called by the server entry point)
// ---------------------------------------------------------------------------

export async function initApp(): Promise<void> {
	try {
		await initializeDatabase();
	} catch (error) {
		console.error("Failed to initialize database:", error);
		console.log("Continuing without database...");
	}
}
