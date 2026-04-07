import { describe, expect, it } from "vitest";
import { formatSearchResult, parseSearchOptions, searchDocuments } from "../src";

describe("core public API", () => {
	it("exports grep command helpers", async () => {
		const options = parseSearchOptions({ pattern: "Obsidian" });
		const result = await searchDocuments(
			[{ path: "note.md", content: "Hello, Obsidian" }],
			options
		);

		expect(formatSearchResult(result, options)).toBe("note.md:Hello, Obsidian");
	});
});
