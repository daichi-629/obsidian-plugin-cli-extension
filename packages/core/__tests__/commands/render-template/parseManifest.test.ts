import { describe, expect, it } from "vitest";
import { parseTemplateManifest } from "../../../src";

describe("parseTemplateManifest", () => {
	it("parses a valid bundle manifest", () => {
		expect(
			parseTemplateManifest(
				JSON.stringify({
					version: 1,
					partialsDir: "partials",
					defaults: { status: "draft" },
					defaultDataFiles: ["defaults/project.json"],
					outputs: [{ template: "README.md", path: "README.md" }]
				})
			)
		).toEqual({
			version: 1,
			description: undefined,
			partialsDir: "partials",
			defaults: { status: "draft" },
			defaultDataFiles: ["defaults/project.json"],
			outputs: [{ template: "README.md", path: "README.md" }]
		});
	});

	it("rejects missing outputs", () => {
		expect(() => parseTemplateManifest(JSON.stringify({ version: 1, outputs: [] }))).toThrow(
			"Template bundle manifest must define at least one output."
		);
	});
});
