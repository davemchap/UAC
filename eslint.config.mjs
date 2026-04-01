import sonarjs from "eslint-plugin-sonarjs";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default tseslint.config(
	// Global ignores
	{
		ignores: ["dist/", "node_modules/", "src/projects/**", "**/*.js", "**/*.mjs"],
	},

	// Base TypeScript strict + stylistic configs
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,

	// SonarJS recommended
	sonarjs.configs.recommended,

	// Project-wide settings
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			"unused-imports": unusedImports,
		},
		rules: {
			// Server application — console is the logging mechanism
			"no-console": "off",

			// Allow template literals with numbers (common in server code: port, counts)
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],

			// SonarJS tuning
			"sonarjs/cognitive-complexity": ["error", 15],
			"sonarjs/no-duplicate-string": ["error", { threshold: 5 }],

			// Unused imports — auto-fixable
			"unused-imports/no-unused-imports": "error",

			// Allow void for fire-and-forget (common in server cleanup)
			"@typescript-eslint/no-confusing-void-expression": ["error", { ignoreVoidOperator: true }],
		},
	},
);
