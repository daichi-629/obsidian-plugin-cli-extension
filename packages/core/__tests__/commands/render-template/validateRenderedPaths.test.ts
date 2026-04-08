import { describe, expect, it } from "vitest";
import { validateRenderedPaths } from "../../../src";

describe("validateRenderedPaths", () => {
	it("normalizes paths and leaves duplicate handling to the caller", () => {
		expect(validateRenderedPaths(["notes/a.md", "notes/a.md"])).toEqual([
			"notes/a.md",
			"notes/a.md"
		]);
	});
});
