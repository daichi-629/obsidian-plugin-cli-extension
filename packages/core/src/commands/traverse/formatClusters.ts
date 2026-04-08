import type { TraverseClustersResult, TraverseOutputFormat } from "./types";

function getNodeName(path: string): string {
	const basename = path.split("/").pop() ?? path;
	return basename.endsWith(".md") ? basename.slice(0, -".md".length) : basename;
}

export function formatTraverseClustersResult(
	result: TraverseClustersResult,
	format: TraverseOutputFormat
): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (format === "tsv") {
		const rows = result.clusters.flatMap((cluster) =>
			cluster.paths.map(
				(path) => `${cluster.index}\t${cluster.size}\t${path}\t${getNodeName(path)}`
			)
		);
		return ["cluster_index\tcluster_size\tpath\tname", ...rows].join("\n");
	}

	const lines = [
		`Scope notes: ${result.scope.noteCount}`,
		`Scope edges: ${result.scope.edgeCount}`,
		`Components (total): ${result.scope.componentCount}`,
		`Components (min-size >= ${result.scope.minSize}): ${result.scope.displayedComponentCount}`,
		`Minimum size: ${result.scope.minSize}`
	];

	if (result.clusters.length === 0) {
		return lines.join("\n");
	}

	return [
		...lines,
		"",
		...result.clusters.map(
			(cluster) => `[${cluster.index}] size=${cluster.size} first=${cluster.paths[0] ?? ""}`
		)
	].join("\n");
}
