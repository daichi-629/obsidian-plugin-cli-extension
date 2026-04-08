import type { TraverseOutputFormat, TraverseReachResult } from "./types";

export function formatTraverseReachResult(
	result: TraverseReachResult,
	format: TraverseOutputFormat
): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (format === "tsv") {
		return [
			"hops\tpath\tname",
			...result.nodes.map((node) => `${node.hops}\t${node.path}\t${node.name}`)
		].join("\n");
	}

	return [
		`Seed: ${result.scope.from}`,
		`Direction: ${result.scope.direction}`,
		`Depth: ${result.scope.depth}`,
		`Nodes: ${result.result.noteCount}`,
		`Edges: ${result.result.edgeCount}`,
		"",
		...result.nodes.map((node) => `${node.hops}  ${node.path}`)
	].join("\n");
}
