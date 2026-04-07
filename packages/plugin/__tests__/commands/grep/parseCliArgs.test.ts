import { describe, expect, it } from "vitest";
import { parseGrepCliArgs } from "../../../src/commands/grep/parseCliArgs";

describe("parseGrepCliArgs", () => {
	it("normalizes the requested path prefix", () => {
		expect(
			parseGrepCliArgs({
				pattern: "TODO",
				path: "/daily/notes/"
			})
		).toEqual({
			ok: true,
			value: {
				pattern: "TODO",
				pathPrefix: "daily/notes/",
				pathPrefixes: ["daily/notes/"],
				excludePathPrefixes: undefined,
				fixedStrings: false,
				ignoreCase: false,
				lineNumber: false,
				filesWithMatches: false,
				count: false,
				beforeContext: undefined,
				afterContext: undefined,
				context: undefined,
				maxResults: undefined,
				stats: false,
				json: false
			}
		});
	});

	it("accepts camelCase flags from the cli adapter", () => {
		expect(
			parseGrepCliArgs({
				pattern: "TODO",
				fixedStrings: "true",
				maxResults: "3"
			})
		).toEqual({
			ok: true,
			value: {
				pattern: "TODO",
				pathPrefix: undefined,
				pathPrefixes: undefined,
				excludePathPrefixes: undefined,
				fixedStrings: true,
				ignoreCase: false,
				lineNumber: false,
				filesWithMatches: false,
				count: false,
				beforeContext: undefined,
				afterContext: undefined,
				context: undefined,
				maxResults: 3,
				stats: false,
				json: false
			}
		});
	});

	it("rejects invalid max-results values in the plugin layer", () => {
		expect(parseGrepCliArgs({ pattern: "TODO", "max-results": "0" })).toEqual({
			ok: false,
			message: "The --max-results option must be a positive integer."
		});
	});

	it("parses context, stats, and json options", () => {
		expect(
			parseGrepCliArgs({
				pattern: "TODO",
				context: "2",
				stats: true,
				json: "true"
			})
		).toEqual({
			ok: true,
			value: {
				pattern: "TODO",
				pathPrefix: undefined,
				pathPrefixes: undefined,
				excludePathPrefixes: undefined,
				fixedStrings: false,
				ignoreCase: false,
				lineNumber: false,
				filesWithMatches: false,
				count: false,
				beforeContext: undefined,
				afterContext: undefined,
				context: 2,
				maxResults: undefined,
				stats: true,
				json: true
			}
		});
	});

	it("parses comma-separated include and exclude path prefixes", () => {
		expect(
			parseGrepCliArgs({
				pattern: "TODO",
				path: "projects/, reference/",
				"exclude-path": "projects/archive/, projects/tmp/"
			})
		).toEqual({
			ok: true,
			value: {
				pattern: "TODO",
				pathPrefix: "projects/",
				pathPrefixes: ["projects/", "reference/"],
				excludePathPrefixes: ["projects/archive/", "projects/tmp/"],
				fixedStrings: false,
				ignoreCase: false,
				lineNumber: false,
				filesWithMatches: false,
				count: false,
				beforeContext: undefined,
				afterContext: undefined,
				context: undefined,
				maxResults: undefined,
				stats: false,
				json: false
			}
		});
	});

	it("rejects invalid context values in the plugin layer", () => {
		expect(parseGrepCliArgs({ pattern: "TODO", "before-context": "-1" })).toEqual({
			ok: false,
			message: "The --before-context option must be a non-negative integer."
		});
	});
});
