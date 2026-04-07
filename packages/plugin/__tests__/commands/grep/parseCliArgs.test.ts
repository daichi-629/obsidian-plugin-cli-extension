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
				fixedStrings: false,
				ignoreCase: false,
				lineNumber: false,
				filesWithMatches: false,
				count: false,
				maxResults: undefined
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
				fixedStrings: true,
				ignoreCase: false,
				lineNumber: false,
				filesWithMatches: false,
				count: false,
				maxResults: 3
			}
		});
	});

	it("rejects invalid max-results values in the plugin layer", () => {
		expect(parseGrepCliArgs({ pattern: "TODO", "max-results": "0" })).toEqual({
			ok: false,
			message: "The --max-results option must be a positive integer."
		});
	});
});
