import { describe, expect, it } from "vitest";
import { formatSearchResult, parseSearchOptions } from "../../../src";

describe("formatSearchResult", () => {
	it("formats default output", () => {
		const options = parseSearchOptions({ pattern: "TODO" });

		expect(
			formatSearchResult(
				{
					matches: [{ path: "notes/a.md", text: "TODO item" }],
					filesScanned: 1,
					matchedFiles: 1,
					skippedFiles: 0,
					stoppedEarly: false
				},
				options
			)
		).toBe("notes/a.md:TODO item");
	});

	it("formats line-number output", () => {
		const options = parseSearchOptions({ pattern: "TODO", lineNumber: true });

		expect(
			formatSearchResult(
				{
					matches: [{ path: "notes/a.md", line: 3, text: "TODO item" }],
					filesScanned: 1,
					matchedFiles: 1,
					skippedFiles: 0,
					stoppedEarly: false
				},
				options
			)
		).toBe("notes/a.md:3:TODO item");
	});

	it("returns a fixed message for empty results", () => {
		const options = parseSearchOptions({ pattern: "TODO" });

		expect(
			formatSearchResult(
				{
					matches: [],
					filesScanned: 2,
					matchedFiles: 0,
					skippedFiles: 0,
					stoppedEarly: false
				},
				options
			)
		).toBe("No matches found.");
	});
});
