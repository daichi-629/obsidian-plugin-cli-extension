import { describe, expect, it } from "vitest";
import { parseRenderTemplateCliArgs } from "../../../src/commands/render-template/parseCliArgs";

describe("parseRenderTemplateCliArgs", () => {
	it("parses data, set, and new execution flags", () => {
		expect(
			parseRenderTemplateCliArgs({
				template: "daily-template.md",
				destination: "daily/test.md",
				data: '{"title":"Daily"}',
				set: ["count=3", "published=true", "meta.owner=alice"],
				write: "dry-run",
				stdout: "status+content/json",
				"existing-file": "replace",
				"duplicate-output": "suffix",
				"data-file": ["vault:data/common.json", "local.json"]
			})
		).toEqual({
			ok: true,
			value: {
				template: "daily-template.md",
				destination: "daily/test.md",
				write: "dry-run",
				stdout: "status+content/json",
				existingFile: "replace",
				duplicateOutput: "suffix",
				dataFile: ["vault:data/common.json", "local.json"],
				data: { title: "Daily" },
				set: [
					{ count: 3 },
					{ published: true },
					{ meta: { owner: "alice" } }
				]
			}
		});
	});
});
