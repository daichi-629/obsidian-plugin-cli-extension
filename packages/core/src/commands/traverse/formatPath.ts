import type { TraverseOutputFormat, TraversePathResult } from "./types";

export function formatTraversePathResult(
	result: TraversePathResult,
	format: TraverseOutputFormat
): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (format === "tsv") {
		const rows =
			result.found === false
				? []
				: result.nodes.map((node) => `${node.index}\t${node.path}\t${node.name}`);
		return ["index\tpath\tname", ...rows].join("\n");
	}

	if (result.found === false) {
		return "No path found.";
	}

	return [`${result.nodes.map((node) => node.path).join(" -> ")}`, `hops: ${result.hops}`].join(
		"\n"
	);
}
