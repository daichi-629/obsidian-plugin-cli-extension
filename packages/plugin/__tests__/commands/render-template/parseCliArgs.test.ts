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
				set: [{ count: 3 }, { published: true }, { meta: { owner: "alice" } }]
			}
		});
	});

	it("supports output-format/include-content aliases", () => {
		expect(
			parseRenderTemplateCliArgs({
				template: "daily-template.md",
				destination: "daily/test.md",
				"output-format": "json",
				"include-content": "",
				write: "dry-run"
			})
		).toEqual({
			ok: true,
			value: {
				template: "daily-template.md",
				destination: "daily/test.md",
				write: "dry-run",
				stdout: "status+content/json",
				existingFile: undefined,
				duplicateOutput: undefined,
				dataFile: [],
				data: undefined,
				set: []
			}
		});
	});

	it("rejects mixing stdout with output aliases", () => {
		expect(
			parseRenderTemplateCliArgs({
				template: "daily-template.md",
				stdout: "status/json",
				"output-format": "json"
			})
		).toEqual({
			ok: false,
			message:
				"Use either --stdout or the --output-format/--include-content aliases, not both."
		});
	});
});
