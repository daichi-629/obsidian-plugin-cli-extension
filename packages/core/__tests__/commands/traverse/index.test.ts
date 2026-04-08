import { describe, expect, it } from "vitest";
import {
	buildGraphSnapshot,
	executeTraverseClusters,
	executeTraversePath,
	executeTraverseReach,
	runTraverseClustersCommand,
	runTraversePathCommand,
	runTraverseReachCommand
} from "../../../src";

function createSnapshot() {
	return buildGraphSnapshot(
		[
			{ path: "projects/a.md", name: "a", folder: "projects", tags: ["project"] },
			{ path: "projects/b.md", name: "b", folder: "projects", tags: ["project"] },
			{ path: "reference/c.md", name: "c", folder: "reference", tags: ["reference"] },
			{ path: "solo/d.md", name: "d", folder: "solo", tags: [] }
		],
		[
			{ from: "projects/a.md", to: "projects/b.md", linkCount: 2 },
			{ from: "projects/b.md", to: "reference/c.md", linkCount: 1 }
		]
	);
}

describe("traverse commands", () => {
	it("builds reach and path results", () => {
		const snapshot = createSnapshot();

		expect(
			executeTraverseReach({
				snapshot,
				from: "projects/a.md",
				depth: 2
			})
		).toMatchObject({
			scope: { noteCount: 4, edgeCount: 2, depth: 2 },
			result: { noteCount: 3, edgeCount: 2 },
			nodes: [
				{ path: "projects/a.md", hops: 0 },
				{ path: "projects/b.md", hops: 1 },
				{ path: "reference/c.md", hops: 2 }
			]
		});

		expect(
			executeTraversePath({
				snapshot,
				from: "projects/a.md",
				to: "reference/c.md",
				format: "json"
			})
		).toMatchObject({
			found: true,
			hops: 2,
			nodes: [
				{ index: 0, path: "projects/a.md" },
				{ index: 1, path: "projects/b.md" },
				{ index: 2, path: "reference/c.md" }
			],
			edges: [
				{ from: "projects/a.md", to: "projects/b.md", linkCount: 2 },
				{ from: "projects/b.md", to: "reference/c.md", linkCount: 1 }
			]
		});
	});

	it("formats no-path and cluster outputs", () => {
		const snapshot = createSnapshot();

		expect(
			runTraversePathCommand({
				snapshot,
				from: "reference/c.md",
				to: "projects/a.md",
				format: "text"
			})
		).toBe("No path found.");
		expect(
			executeTraverseClusters({
				snapshot,
				minSize: 2
			})
		).toMatchObject({
			scope: {
				componentCount: 2,
				displayedComponentCount: 1,
				minSize: 2
			},
			clusters: [{ index: 0, size: 3, paths: ["projects/a.md", "projects/b.md", "reference/c.md"] }]
		});
		expect(
			runTraverseReachCommand({
				snapshot,
				from: "projects/a.md",
				depth: 1,
				format: "tsv"
			})
		).toBe("hops\tpath\tname\n0\tprojects/a.md\ta\n1\tprojects/b.md\tb");
		expect(
			runTraverseClustersCommand({
				snapshot,
				minSize: 2,
				format: "tsv"
			})
		).toContain("cluster_index\tcluster_size\tpath\tname");
	});
});
