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

	it("throws for invalid context values", () => {
		expect(() => parseSearchOptions({ pattern: "TODO", context: -1 })).toThrow(
			"The --context option must be a non-negative integer."
		);
	});

	it("allows files-with-matches and count together", () => {
		expect(
			parseSearchOptions({
				pattern: "TODO",
				filesWithMatches: true,
				count: true
			})
		).toMatchObject({
			filesWithMatches: true,
			count: true
		});
	});

	it("throws for invalid regex during execution setup", () => {
		const options = parseSearchOptions({ pattern: "(" });
		return expect(searchDocuments([], options)).rejects.toThrow(
			"Invalid regular expression: ("
		);
	});

	it("resolves directional context from the shared context option", () => {
		expect(parseSearchOptions({ pattern: "TODO", context: 2 })).toMatchObject({
			beforeContext: 2,
			afterContext: 2
		});
	});
});
