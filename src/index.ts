import { closeDatabase } from "./components/db";
import { app, initApp } from "./bases/http/app";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

async function main(): Promise<void> {
	console.log("================================================");
	console.log("  Ship Summit Fullstack App");
	console.log("================================================\n");

	await initApp();

	const server = Bun.serve({ port: PORT, fetch: app.fetch });

	console.log(`\nServer running at http://localhost:${server.port}`);
	console.log(`  Frontend: http://localhost:${server.port}/`);
	console.log(`  Health:   http://localhost:${server.port}/health`);
	console.log(`  API:      http://localhost:${server.port}/api`);
	console.log("\nPress Ctrl+C to stop the server");

	const shutdown = (): void => {
		console.log("\nShutting down...");
		closeDatabase()
			.then(() => process.exit(0))
			.catch((err: unknown) => {
				console.error("Error during shutdown:", err);
				process.exit(1);
			});
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error("Failed to start application:", error);
		process.exit(1);
	});
}
