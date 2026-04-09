import { describe, expect, it } from "vitest";
import { parseSearchOptions, searchDocuments } from "../../../src";

describe("searchDocuments", () => {
	it("finds fixed-string matches across markdown files", async () => {
		const options = parseSearchOptions({
			pattern: "TODO",
			fixedStrings: true
		});
		const result = await searchDocuments(
			[
				{ path: "daily/2026-04-08.md", content: "TODO ship\nDone" },
				{ path: "notes/ideas.md", content: "No match\nTODO test" }
			],
			options
		);

		expect(result.matches).toEqual([
			{
				path: "daily/2026-04-08.md",
				line: undefined,
				text: "TODO ship",
				kind: "match"
			},
			{ path: "notes/ideas.md", line: undefined, text: "TODO test", kind: "match" }
		]);
		expect(result.matchedFiles).toBe(2);
		expect(result.filesScanned).toBe(2);
		expect(result.totalMatches).toBe(2);
	});

	it("supports regex and line numbers", async () => {
		const options = parseSearchOptions({
			pattern: "^todo",
			ignoreCase: true,
			lineNumber: true
		});
		const result = await searchDocuments(
			[{ path: "notes/tasks.md", content: "skip\nTodo later\nTODO now" }],
			options
		);

		expect(result.matches).toEqual([
			{ path: "notes/tasks.md", line: 2, text: "Todo later", kind: "match" },
			{ path: "notes/tasks.md", line: 3, text: "TODO now", kind: "match" }
		]);
	});

	it("collapses to one result per file with filesWithMatches", async () => {
		const options = parseSearchOptions({
			pattern: "todo",
			ignoreCase: true,
			filesWithMatches: true
		});
		const result = await searchDocuments(
			[
				{ path: "a.md", content: "todo\nTODO" },
				{ path: "b.md", content: "none" }
			],
			options
		);

		expect(result.matches).toEqual([{ path: "a.md", text: "" }]);
		expect(result.matchedFiles).toBe(1);
		expect(result.totalMatches).toBe(2);
	});

	it("counts matches per file", async () => {
		const options = parseSearchOptions({
			pattern: "TODO",
			fixedStrings: true,
			count: true
		});
		const result = await searchDocuments(
			[
				{ path: "a.md", content: "TODO\nskip\nTODO" },
				{ path: "b.md", content: "TODO" }
			],
			options
		);

		expect(result.matches).toEqual([
			{ path: "a.md", text: "2" },
			{ path: "b.md", text: "1" }
		]);
		expect(result.totalMatches).toBe(3);
	});

	it("prefers count output when filesWithMatches and count are both set", async () => {
		const options = parseSearchOptions({
			pattern: "TODO",
			fixedStrings: true,
			filesWithMatches: true,
			count: true
		});
		const result = await searchDocuments(
			[
				{ path: "a.md", content: "TODO\nskip\nTODO" },
				{ path: "b.md", content: "TODO" }
			],
			options
		);

		expect(result.matches).toEqual([
			{ path: "a.md", text: "2" },
			{ path: "b.md", text: "1" }
		]);
	});

	it("stops early when maxResults is reached", async () => {
		const options = parseSearchOptions({
			pattern: "TODO",
			fixedStrings: true,
			maxResults: 1
		});
		const result = await searchDocuments(
			[
				{ path: "a.md", content: "TODO one\nTODO two" },
				{ path: "b.md", content: "TODO three" }
			],
			options
		);

		expect(result.matches).toEqual([
			{ path: "a.md", line: undefined, text: "TODO one", kind: "match" }
		]);
		expect(result.stoppedEarly).toBe(true);
		expect(result.filesScanned).toBe(1);
		expect(result.totalMatches).toBe(1);
	});

	it("includes surrounding context lines without duplication", async () => {
		const options = parseSearchOptions({
			pattern: "TODO",
			fixedStrings: true,
			context: 1
		});
		const result = await searchDocuments(
			[
				{
					path: "notes/context.md",
					content: "first\nTODO alpha\nshared\nTODO beta\nlast"
				}
			],
			options
		);

		expect(result.matches).toEqual([
			{ path: "notes/context.md", line: 1, text: "first", kind: "context" },
			{ path: "notes/context.md", line: 2, text: "TODO alpha", kind: "match" },
			{ path: "notes/context.md", line: 3, text: "shared", kind: "context" },
			{ path: "notes/context.md", line: 4, text: "TODO beta", kind: "match" },
			{ path: "notes/context.md", line: 5, text: "last", kind: "context" }
		]);
		expect(result.totalMatches).toBe(2);
	});

	it("counts only matched lines toward maxResults when context is enabled", async () => {
		const options = parseSearchOptions({
			pattern: "TODO",
			fixedStrings: true,
			context: 1,
			maxResults: 1
		});
		const result = await searchDocuments(
			[
				{
					path: "notes/context.md",
					content: "before\nTODO alpha\nafter\nTODO beta\nlast"
				}
			],
			options
		);

		expect(result.matches).toEqual([
			{ path: "notes/context.md", line: 1, text: "before", kind: "context" },
			{ path: "notes/context.md", line: 2, text: "TODO alpha", kind: "match" },
			{ path: "notes/context.md", line: 3, text: "after", kind: "context" }
		]);
		expect(result.totalMatches).toBe(1);
		expect(result.stoppedEarly).toBe(true);
	});
});
