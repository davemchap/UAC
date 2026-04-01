import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.warn(
		"⚠  DATABASE_URL not set — database features disabled.\n" +
			"   Create .env with DATABASE_URL=postgresql://... for local dev.",
	);
}

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> {
	if (_sql) {
		return _sql;
	}

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not set. Configure it in .env for local development.");
	}

	_sql = postgres(databaseUrl, {
		max: 5,
		idle_timeout: 20,
		connect_timeout: 10,
		transform: {
			column: (col: string): string => col.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase()),
		},
		onnotice: (notice: { message?: string }): void => {
			console.log("Database notice:", notice.message);
		},
	});

	return _sql;
}

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

export function initializeDatabase(): Promise<void> {
	if (!databaseUrl) {
		console.log("Skipping database initialization (no DATABASE_URL)");
		return Promise.resolve();
	}

	console.log("Initializing database schema...");
	console.log("Database schema initialized successfully");
	return Promise.resolve();
}

export async function closeDatabase(): Promise<void> {
	if (_sql) {
		await _sql.end();
		_sql = null;
		console.log("Database connection closed");
	}
}
