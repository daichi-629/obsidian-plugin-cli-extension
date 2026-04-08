import { describe, expect, it } from "vitest";
import { buildGraphSnapshot } from "@sample/core";
import { resolveGraphOperand } from "../../src/graph/resolveGraphOperand";

const snapshot = buildGraphSnapshot(
	[
		{ path: "notes/Atlas.md", name: "Atlas", folder: "notes", tags: [] },
		{ path: "projects/Atlas.md", name: "Atlas", folder: "projects", tags: [] },
		{ path: "projects/atlas/README.md", name: "README", folder: "projects/atlas", tags: [] }
	],
	[]
);

describe("resolveGraphOperand", () => {
	it("resolves canonical paths and unique linkpaths", () => {
		expect(resolveGraphOperand(snapshot, "notes/Atlas.md")).toBe("notes/Atlas.md");
		expect(resolveGraphOperand(snapshot, "projects/atlas/README")).toBe(
			"projects/atlas/README.md"
		);
	});

	it("rejects ambiguous basenames", () => {
		expect(() => resolveGraphOperand(snapshot, "Atlas")).toThrowError(
			'Ambiguous note operand: "Atlas"'
		);
	});
});
