import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";

export default [
	js.configs.recommended,
	...tseslint.configs.recommended,
	globalIgnores(["dist", "node_modules"]),
	{
		files: ["**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "obsidian",
							message: "core package must not import obsidian"
						}
					]
				}
			]
		}
	}
];
