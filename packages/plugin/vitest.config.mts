import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@sample/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url))
		}
	},
	test: {
		include: ["__tests__/**/*.test.ts"]
	}
});
