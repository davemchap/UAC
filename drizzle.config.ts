import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/components/db/schema.ts",
	out: "./src/components/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "",
	},
});
