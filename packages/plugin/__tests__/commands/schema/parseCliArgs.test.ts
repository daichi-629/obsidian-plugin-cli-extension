import { describe, expect, it } from "vitest";
import {
	parseSchemaInferCliArgs,
	parseSchemaMissingCliArgs,
	parseSchemaValidateCliArgs
} from "../../../src/commands/schema/parseCliArgs";

describe("schema cli parsing", () => {
	it("parses infer options", () => {
		expect(
			parseSchemaInferCliArgs({
				folder: "/projects/",
				tag: "#project",
				"group-by": "property:type",
				"min-coverage": "25",
				format: "json"
			})
		).toEqual({
			ok: true,
			value: {
				folder: "/projects/",
				tag: "#project",
				groupBy: "property:type",
				minCoverage: 25,
				format: "json"
			}
		});
	});

	it("requires key for missing mode", () => {
		expect(parseSchemaMissingCliArgs({ format: "tsv" })).toEqual({
			ok: false,
			message: "The missing command requires key=<key>."
		});
	});

	it("parses repeated validate paths and validates format", () => {
		expect(
			parseSchemaValidateCliArgs({
				path: ["projects/a.md", "inbox/c.md"],
				"missing-threshold": "80",
				"fail-on": "none",
				format: "json"
			} as never)
		).toEqual({
			ok: true,
			value: {
				folder: undefined,
				tag: undefined,
				paths: ["projects/a.md", "inbox/c.md"],
				missingThreshold: 80,
				failOn: "none",
				format: "json"
			}
		});
	});

	it("accepts a JSON array in path for runtime adapters that collapse repeated flags", () => {
		expect(
			parseSchemaValidateCliArgs({
				path: '["HOME.md","reference/frontmatter-lab.md"]',
				format: "json"
			})
		).toEqual({
			ok: true,
			value: {
				folder: undefined,
				tag: undefined,
				paths: ["HOME.md", "reference/frontmatter-lab.md"],
				missingThreshold: undefined,
				failOn: undefined,
				format: "json"
			}
		});
	});
});
