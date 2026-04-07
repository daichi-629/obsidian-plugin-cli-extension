import { describe, expect, it } from "vitest";
import { formatSearchResult, parseSearchOptions } from "../../../src";

describe("formatSearchResult", () => {
	it("formats default output", () => {
		const options = parseSearchOptions({ pattern: "TODO" });

		expect(
			formatSearchResult(
				{
					matches: [{ path: "notes/a.md", text: "TODO item", kind: "match" }],
					filesScanned: 1,
					matchedFiles: 1,
					skippedFiles: 0,
					stoppedEarly: false,
					totalMatches: 1
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
					matches: [{ path: "notes/a.md", line: 3, text: "TODO item", kind: "match" }],
					filesScanned: 1,
					matchedFiles: 1,
					skippedFiles: 0,
					stoppedEarly: false,
					totalMatches: 1
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
					stoppedEarly: false,
					totalMatches: 0
				},
				options
			)
		).toBe("No matches found.");
	});

	it("formats context output with grep-style separators", () => {
		const options = parseSearchOptions({ pattern: "TODO", context: 1 });

		expect(
			formatSearchResult(
				{
					matches: [
						{ path: "notes/a.md", line: 2, text: "before", kind: "context" },
						{ path: "notes/a.md", line: 3, text: "TODO item", kind: "match" }
					],
					filesScanned: 1,
					matchedFiles: 1,
					skippedFiles: 0,
					stoppedEarly: false,
					totalMatches: 1
				},
				options
			)
		).toBe("notes/a.md-2-before\nnotes/a.md:3:TODO item");
	});

	it("appends stats in plain-text mode", () => {
		const options = parseSearchOptions({ pattern: "TODO", stats: true });

		expect(
			formatSearchResult(
				{
					matches: [{ path: "notes/a.md", text: "TODO item", kind: "match" }],
					filesScanned: 3,
					matchedFiles: 1,
					skippedFiles: 1,
					stoppedEarly: true,
					totalMatches: 1
				},
				options
			)
		).toBe(
			[
				"notes/a.md:TODO item",
				"Stats:",
				"filesScanned=3",
				"matchedFiles=1",
				"skippedFiles=1",
				"totalMatches=1",
				"stoppedEarly=true"
			].join("\n")
		);
	});

	it("renders JSON output", () => {
		const options = parseSearchOptions({ pattern: "TODO", json: true });

		expect(
			formatSearchResult(
				{
					matches: [{ path: "notes/a.md", line: 3, text: "TODO item", kind: "match" }],
					filesScanned: 1,
					matchedFiles: 1,
					skippedFiles: 0,
					stoppedEarly: false,
					totalMatches: 1
				},
				options
			)
		).toContain('"totalMatches": 1');
	});
});
