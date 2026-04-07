import { describe, expect, it } from "vitest";
import { formatApplyPatchResult } from "../../../src";

describe("formatApplyPatchResult", () => {
	it("formats successful dry-run output", () => {
		expect(
			formatApplyPatchResult(
				{
					dryRun: true,
					changedFileCount: 2,
					files: [
						{ path: "notes/todo.md", operation: "update", status: "planned" },
						{ path: "notes/old.md", operation: "delete", status: "planned" }
					]
				},
				{ dryRun: true, verbose: false }
			)
		).toBe(
			"Dry run completed. 2 file changes planned.\nUpdated: notes/todo.md\nDeleted: notes/old.md"
		);
	});

	it("formats partial failures", () => {
		expect(
			formatApplyPatchResult(
				{
					dryRun: false,
					changedFileCount: 1,
					files: [
						{ path: "notes/todo.md", operation: "update", status: "applied" },
						{
							path: "src/app.ts",
							operation: "update",
							status: "failed",
							message: "context not found at @@ function greet"
						},
						{ path: "scratch/old.md", operation: "delete", status: "skipped" }
					]
				},
				{ dryRun: false, verbose: false }
			)
		).toBe(
			"Patch partially applied. 1 of 3 files changed.\nUpdated: notes/todo.md\nFailed: src/app.ts - context not found at @@ function greet\nSkipped: scratch/old.md"
		);
	});
});
