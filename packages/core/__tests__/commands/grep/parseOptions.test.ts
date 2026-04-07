import { describe, expect, it } from "vitest";
import { parseSearchOptions, searchDocuments } from "../../../src";

describe("parseSearchOptions", () => {
	it("throws for missing pattern", () => {
		expect(() => parseSearchOptions({})).toThrow("The --pattern option is required.");
	});

	it("throws for invalid maxResults", () => {
		expect(() => parseSearchOptions({ pattern: "TODO", maxResults: 0 })).toThrow(
			"The --max-results option must be a positive integer."
		);
	});

	it("throws for conflicting output modes", () => {
		expect(() =>
			parseSearchOptions({
				pattern: "TODO",
				filesWithMatches: true,
				count: true
			})
		).toThrow("The --files-with-matches and --count options cannot be used together.");
	});

	it("throws for invalid regex during execution setup", () => {
		const options = parseSearchOptions({ pattern: "(" });
		return expect(searchDocuments([], options)).rejects.toThrow("Invalid regular expression: (");
	});
});
