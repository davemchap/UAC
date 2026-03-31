/**
 * Database Connection Module
 *
 * This module handles PostgreSQL database connections using the 'postgres' library.
 * The connection is configured via the DATABASE_URL environment variable, which is
 * automatically injected by the CI/CD pipeline when deploying to ECS.
 *
 * CUSTOMIZATION:
 * - You can add connection pool settings below
 * - Add your own database utility functions
 * - Create migration helpers if needed
 */

import postgres from "postgres";

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

// Get the database URL from environment variables
// This is automatically set by the CI/CD pipeline in production
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.warn(
		"⚠  DATABASE_URL not set — database features disabled.\n" +
			"   Create .env with DATABASE_URL=postgresql://... for local dev.",
	);
}

// Lazily-initialized connection — created on first use, cached thereafter.
// This prevents the connection object from being poisoned at startup when
// DATABASE_URL is absent (e.g. in Coder workspaces where it is only injected
// by CI into ECS containers).
let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Return the shared postgres connection, creating it on first call.
 * Throws if DATABASE_URL is not set.
 */
export function getSql(): ReturnType<typeof postgres> {
	if (_sql) {
		return _sql;
	}

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not set. Configure it in .env for local development.");
	}

	_sql = postgres(databaseUrl, {
		// Connection pool settings (customize as needed)
		// Each team has a 10-connection limit; two processes share it (dev + deployed).
		// Keep pool max at 5 so two processes never exceed the per-user limit.
		max: 5, // Maximum number of connections in pool
		idle_timeout: 20, // Close idle connections after 20 seconds
		connect_timeout: 10, // Timeout for new connections

		// Transform options
		transform: {
			// Convert snake_case column names to camelCase in JavaScript
			column: (col: string): string => col.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase()),
		},

		// Error handling
		onnotice: (notice: { message?: string }): void => {
			console.log("Database notice:", notice.message);
		},
	});

	return _sql;
}

// =============================================================================
// DATABASE UTILITIES
// =============================================================================

/**
 * Check if the database connection is healthy
 * Used by the /health endpoint
 */
export async function checkDatabaseHealth(): Promise<boolean> {
	if (!databaseUrl) {
		return false;
	}

	try {
		const sql = getSql();
		await sql`SELECT 1`;
		return true;
	} catch (error) {
		console.error("Database health check failed:", error);
		return false;
	}
}

/**
 * Initialize the database schema
 * Creates necessary tables if they don't exist
 *
 * CUSTOMIZATION: Add your own tables here!
 */
export function initializeDatabase(): Promise<void> {
	if (!databaseUrl) {
		console.log("Skipping database initialization (no DATABASE_URL)");
		return Promise.resolve();
	}

	console.log("Initializing database schema...");

	// CUSTOMIZE: Add your own CREATE TABLE statements here!
	// Example:
	// const sql = getSql();
	// return sql`CREATE TABLE IF NOT EXISTS my_table (...)`.then(() => {
	//   console.log("Database schema initialized successfully");
	// });

	console.log("Database schema initialized successfully");
	return Promise.resolve();
}

/**
 * Close the database connection
 * Call this when shutting down the application
 */
export async function closeDatabase(): Promise<void> {
	if (_sql) {
		await _sql.end();
		_sql = null;
		console.log("Database connection closed");
	}
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// CUSTOMIZE: Add your own TypeScript types/interfaces here to match your schema.
// Example:
// export interface MyRecord {
//   id: number;
//   name: string;
//   createdAt: Date;
// }
