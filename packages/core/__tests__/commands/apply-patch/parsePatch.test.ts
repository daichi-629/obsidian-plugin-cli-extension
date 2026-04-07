import { describe, expect, it } from "vitest";
import {
	parseApplyPatch,
	planApplyPatchChanges,
	validateApplyPatchInput
} from "../../../src";

describe("parseApplyPatch", () => {
	it("parses add, delete, update, and move operations", () => {
		const plan = parseApplyPatch(`*** Begin Patch
*** Add File: notes/new.md
+hello
*** Update File: notes/todo.md
*** Move to: notes/done.md
@@ heading
 old
-before
+after
*** Delete File: notes/old.md
*** End Patch`);

		expect(plan.operations).toEqual([
			{ type: "add", path: "notes/new.md", contents: "hello" },
			{
				type: "update",
				path: "notes/todo.md",
				moveTo: "notes/done.md",
				chunks: [
					{
						context: ["heading"],
						oldLines: ["old", "before"],
						newLines: ["old", "after"]
					}
				]
			},
			{ type: "delete", path: "notes/old.md" }
		]);
	});

	it("normalizes CRLF input", () => {
		const input = validateApplyPatchInput({
			patchText: "*** Begin Patch\r\n*** Add File: a.txt\r\n+hello\r\n*** End Patch\r\n",
			dryRun: false,
			verbose: false,
			allowCreate: true
		});

		const plan = parseApplyPatch(input.patchText);
		expect(plan.operations).toEqual([{ type: "add", path: "a.txt", contents: "hello" }]);
	});

	it("rejects empty updates without move", () => {
		expect(() =>
			parseApplyPatch(`*** Begin Patch
*** Update File: notes/todo.md
*** End Patch`)
		).toThrowError("Update File requires at least one change: notes/todo.md");
	});
});

describe("planApplyPatchChanges", () => {
	it("rejects add operations when allowCreate is disabled", () => {
		const plan = parseApplyPatch(`*** Begin Patch
*** Add File: notes/new.md
+hello
*** End Patch`);

		expect(() => planApplyPatchChanges(plan, { allowCreate: false })).toThrowError(
			"Add File is not allowed without --allow-create: notes/new.md"
		);
	});
});
