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
