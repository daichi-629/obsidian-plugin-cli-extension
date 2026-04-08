import { describe, expect, it } from "vitest";
import {
	buildGraphSnapshot,
	computeReachability,
	filterGraphScope,
	findShortestPath,
	findWeakComponents,
	type GraphSnapshot
} from "../../src";

function createSnapshot(): GraphSnapshot {
	return buildGraphSnapshot(
		[
			{ path: "areas/a.md", name: "a", folder: "areas", tags: ["project"] },
			{ path: "areas/b.md", name: "b", folder: "areas", tags: ["project"] },
			{ path: "areas/c.md", name: "c", folder: "areas", tags: ["idea"] },
			{ path: "notes/d.md", name: "d", folder: "notes", tags: ["idea"] },
			{ path: "solo/e.md", name: "e", folder: "solo", tags: [] }
		],
		[
			{ from: "areas/a.md", to: "areas/b.md", linkCount: 1 },
			{ from: "areas/a.md", to: "areas/c.md", linkCount: 1 },
			{ from: "areas/b.md", to: "notes/d.md", linkCount: 1 },
			{ from: "areas/c.md", to: "notes/d.md", linkCount: 1 }
		]
	);
}

describe("graph traversal primitives", () => {
	it("filters scope and computes deterministic reachability", () => {
		const scoped = filterGraphScope(createSnapshot(), { folder: "areas", tag: "#project" });

		expect(scoped.scope).toEqual({
			folder: "areas",
			tag: "project",
			noteCount: 2,
			edgeCount: 1
		});
		expect(
			computeReachability({
				snapshot: createSnapshot(),
				from: "areas/a.md",
				depth: 1,
				direction: "out"
			})
		).toEqual({
			nodes: [
				{ path: "areas/a.md", hops: 0 },
				{ path: "areas/b.md", hops: 1 },
				{ path: "areas/c.md", hops: 1 }
			],
			edges: [
				{ from: "areas/a.md", to: "areas/b.md", linkCount: 1 },
				{ from: "areas/a.md", to: "areas/c.md", linkCount: 1 }
			]
		});
	});

	it("returns stable shortest paths and weak components", () => {
		const snapshot = createSnapshot();

		expect(
			findShortestPath({
				snapshot,
				from: "areas/a.md",
				to: "notes/d.md",
				direction: "out"
			})
		).toEqual(["areas/a.md", "areas/b.md", "notes/d.md"]);
		expect(
			findShortestPath({
				snapshot,
				from: "notes/d.md",
				to: "areas/a.md",
				direction: "both"
			})
		).toEqual(["notes/d.md", "areas/b.md", "areas/a.md"]);
		expect(findWeakComponents(snapshot)).toEqual([
			["areas/a.md", "areas/b.md", "areas/c.md", "notes/d.md"],
			["solo/e.md"]
		]);
	});
});
