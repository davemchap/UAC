/**
 * Ship Summit Fullstack App
 *
 * A fullstack TypeScript application with:
 * - Hono backend serving API routes at /api/*
 * - Static frontend served from /public at root path
 * - PostgreSQL database support
 *
 * CUSTOMIZATION:
 * - Add new API routes in src/api/ and import them here
 * - Modify the database schema in src/db.ts
 * - Edit frontend files in src/public/
 * - Add middleware for authentication, logging, etc.
 *
 * For local development:
 *   1. Create a .env file with DATABASE_URL
 *   2. Run: bun run dev
 *
 * For production deployment:
 *   - Push to GitLab, and the CI/CD pipeline will handle the rest!
 */

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
// Proxy routes: server-side CORS proxy for external APIs that block browser requests.
// Routes: /api/proxy/avalanche/forecast, /api/proxy/avalanche/zones, /api/proxy/snotel/station/:triplet
import proxy from "./api/proxy";
import { checkDatabaseHealth, closeDatabase, initializeDatabase } from "./db";

// =============================================================================
// APP CONFIGURATION
// =============================================================================

// Create the main Hono application
// Exported so it can be imported in tests without starting the server
export const app = new Hono();

// Get port from environment variable or default to 3000
// ECS will set the PORT environment variable
const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Enable CORS for API routes
// CUSTOMIZE: Adjust origin settings for production security
app.use(
	"/api/*",
	cors({
		origin: "*", // In production, specify allowed origins
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	}),
);

// Request logging middleware
// Shows: --> GET /api/health 200 12ms
app.use("*", logger());

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * Health check endpoint for ECS/ALB health checks
 * Returns 200 if the service is healthy, 503 if not
 *
 * DO NOT REMOVE - This is required for ECS deployment!
 */
app.get("/health", async (c) => {
	const dbHealthy = await checkDatabaseHealth();

	const health = {
		status: dbHealthy ? "healthy" : "degraded",
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version ?? "1.0.0",
		checks: {
			database: dbHealthy ? "connected" : "disconnected",
		},
	};

	// Return 200 even if database is down (service itself is running)
	// Adjust this logic based on your requirements
	return c.json(health, dbHealthy ? 200 : 503);
});

// =============================================================================
// API ROUTES
// =============================================================================

// Mount the CORS proxy router
// Proxies external APIs that block browser requests (no CORS headers on origin)
// CUSTOMIZE: Add more API routers here for additional resources
app.route("/api/proxy", proxy);

// API root endpoint - shows available API endpoints
app.get("/api", (c) => {
	return c.json({
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
	});
});

// =============================================================================
// STATIC FILE SERVING
// =============================================================================

// Serve static files from src/public directory
// This serves the frontend at the root path
app.use(
	"/*",
	serveStatic({
		root: "./src/public",
		// Rewrite root requests to index.html
		rewriteRequestPath: (path) => {
			// If path is root or doesn't have an extension, serve index.html
			if (path === "/" || (!path.includes(".") && !path.startsWith("/api"))) {
				return "/index.html";
			}
			return path;
		},
	}),
);

// =============================================================================
// 404 HANDLER
// =============================================================================

app.notFound((c) => {
	// For API routes, return JSON error
	if (c.req.path.startsWith("/api")) {
		return c.json(
			{
				success: false,
				error: "Not found",
				message: `API route ${c.req.method} ${c.req.path} does not exist`,
			},
			404,
		);
	}

	// For other routes, return HTML
	return c.html(
		`<!DOCTYPE html>
<html>
<head>
  <title>404 - Not Found</title>
</head>
<body>
  <h1>404 - Page Not Found</h1>
  <p>The page you're looking for doesn't exist.</p>
  <p><a href="/">Go back home</a></p>
</body>
</html>`,
		404,
	);
});

// =============================================================================
// ERROR HANDLER
// =============================================================================

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
		`<!DOCTYPE html>
<html>
<head>
  <title>500 - Server Error</title>
</head>
<body>
  <h1>500 - Server Error</h1>
  <p>Something went wrong. Please try again later.</p>
</body>
</html>`,
		500,
	);
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Initialize the application and start the server
 */
async function main(): Promise<void> {
	console.log("================================================");
	console.log("  Ship Summit Fullstack App");
	console.log("================================================");
	console.log("");

	// Initialize database schema (creates tables if needed)
	try {
		await initializeDatabase();
	} catch (error) {
		console.error("Failed to initialize database:", error);
		console.log("Continuing without database...");
	}

	// Start the HTTP server
	console.log("");
	console.log(`Starting server on port ${PORT}...`);
	console.log("");

	// Use Bun's built-in server
	const server = Bun.serve({
		port: PORT,
		fetch: app.fetch,
	});

	console.log(`Server running at http://localhost:${server.port}`);
	console.log("");
	console.log("Available endpoints:");
	console.log(`  - Frontend: http://localhost:${server.port}/`);
	console.log(`  - Health:   http://localhost:${server.port}/health`);
	console.log(`  - API:      http://localhost:${server.port}/api`);
	console.log(
		`  - Proxy:    http://localhost:${server.port}/api/proxy (avalanche/zones, avalanche/forecast, snotel/station/:triplet)`,
	);
	console.log("");
	console.log("Press Ctrl+C to stop the server");

	// Handle graceful shutdown
	process.on("SIGTERM", () => {
		console.log("\nReceived SIGTERM, shutting down gracefully...");
		closeDatabase()
			.then(() => process.exit(0))
			.catch((err: unknown) => {
				console.error("Error during shutdown:", err);
				process.exit(1);
			});
	});

	process.on("SIGINT", () => {
		console.log("\nReceived SIGINT, shutting down gracefully...");
		closeDatabase()
			.then(() => process.exit(0))
			.catch((err: unknown) => {
				console.error("Error during shutdown:", err);
				process.exit(1);
			});
	});
}

// Only start the server when this file is the entry point (not when imported in tests)
if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error("Failed to start application:", error);
		process.exit(1);
	});
}
