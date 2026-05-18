import { describe, expect, it } from "vitest";
import { executeApplyPatchUpdate } from "../../../src";

describe("executeApplyPatchUpdate", () => {
	it("applies an anchored replacement", () => {
		const result = executeApplyPatchUpdate({
			path: "notes/todo.md",
			chunks: [
				{
					context: ["Tasks"],
					oldLines: ["alpha", "beta"],
					newLines: ["alpha", "gamma"]
				}
			],
			currentContent: "Tasks\nalpha\nbeta\nend"
		});

		expect(result.nextContent).toBe("Tasks\nalpha\ngamma\nend");
		expect(result.changed).toBe(true);
	});

	it("supports rename-only updates", () => {
		const result = executeApplyPatchUpdate({
			path: "notes/todo.md",
			moveTo: "notes/done.md",
			chunks: [],
			currentContent: "alpha\nbeta"
		});

		expect(result.renamed).toBe(true);
		expect(result.changed).toBe(false);
		expect(result.nextContent).toBe("alpha\nbeta");
	});

	it("supports end-of-file updates", () => {
		const result = executeApplyPatchUpdate({
			path: "notes/todo.md",
			chunks: [
				{
					context: [],
					oldLines: ["beta"],
					newLines: ["beta", "gamma"],
					isEndOfFile: true
				}
			],
			currentContent: "alpha\nbeta"
		});

		expect(result.nextContent).toBe("alpha\nbeta\ngamma");
	});

	it("matches bare hunk markers at file-leading lines", () => {
		const result = executeApplyPatchUpdate({
			path: "notes/frontmatter.md",
			chunks: [
				{
					context: [""],
					oldLines: ["modified: 2026-05-18T12:50:00+09:00"],
					newLines: ["modified: 2026-05-18T12:51:00+09:00"]
				},
				{
					context: [""],
					oldLines: ["# Repro Title"],
					newLines: ["# Repro Title Updated"]
				}
			],
			currentContent:
				"---\nmodified: 2026-05-18T12:50:00+09:00\n---\n# Repro Title\n\n## Section\n\nbody\n"
		});

		expect(result.nextContent).toBe(
			"---\nmodified: 2026-05-18T12:51:00+09:00\n---\n# Repro Title Updated\n\n## Section\n\nbody\n"
		);
	});

	it("matches bare hunk markers in short files", () => {
		const result = executeApplyPatchUpdate({
			path: "notes/short.md",
			chunks: [
				{
					context: [""],
					oldLines: ["second line"],
					newLines: ["second line updated"]
				}
			],
			currentContent: "first line\nsecond line\n"
		});

		expect(result.nextContent).toBe("first line\nsecond line updated\n");
	});

	it("rejects ambiguous matches", () => {
		expect(() =>
			executeApplyPatchUpdate({
				path: "notes/todo.md",
				chunks: [
					{
						context: [],
						oldLines: ["repeat"],
						newLines: ["changed"]
					}
				],
				currentContent: "repeat\nrepeat"
			})
		).toThrowError("Patch context is ambiguous at line 'repeat'.");
	});
});
