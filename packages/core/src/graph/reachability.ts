import { compareGraphPaths } from "./buildGraphSnapshot";
import type { GraphDirection, GraphEdge, GraphSnapshot } from "./types";

type ReachabilityInput = {
	snapshot: GraphSnapshot;
	from: string;
	depth: number;
	direction: GraphDirection;
};

export type ReachabilityResult = {
	nodes: Array<{
		path: string;
		hops: number;
	}>;
	edges: GraphEdge[];
};

function getNeighborPaths(
	snapshot: GraphSnapshot,
	path: string,
	direction: GraphDirection
): string[] {
	if (direction === "out") {
		return (snapshot.outgoing[path] ?? []).map((edge) => edge.to);
	}

	if (direction === "in") {
		return (snapshot.incoming[path] ?? []).map((edge) => edge.from);
	}

	return [
		...new Set([
			...(snapshot.outgoing[path] ?? []).map((edge) => edge.to),
			...(snapshot.incoming[path] ?? []).map((edge) => edge.from)
		])
	].sort(compareGraphPaths);
}

export function computeReachability(input: ReachabilityInput): ReachabilityResult {
	const hopsByPath = new Map<string, number>();
	const queue: string[] = [input.from];
	hopsByPath.set(input.from, 0);

	for (let index = 0; index < queue.length; index += 1) {
		const path = queue[index];
		if (!path) {
			continue;
		}

		const hops = hopsByPath.get(path) ?? 0;
		if (hops >= input.depth) {
			continue;
		}

		for (const neighborPath of getNeighborPaths(input.snapshot, path, input.direction)) {
			if (hopsByPath.has(neighborPath)) {
				continue;
			}

			hopsByPath.set(neighborPath, hops + 1);
			queue.push(neighborPath);
		}
	}

	const visited = new Set(hopsByPath.keys());
	return {
		nodes: [...hopsByPath.entries()]
			.map(([path, hops]) => ({ path, hops }))
			.sort(
				(left, right) => left.hops - right.hops || compareGraphPaths(left.path, right.path)
			),
		edges: input.snapshot.edges.filter((edge) => visited.has(edge.from) && visited.has(edge.to))
	};
}
