import { compareGraphPaths } from "./buildGraphSnapshot";
import type { GraphDirection, GraphSnapshot } from "./types";

type ShortestPathInput = {
	snapshot: GraphSnapshot;
	from: string;
	to: string;
	direction: Exclude<GraphDirection, "in">;
};

function getNeighborPaths(
	snapshot: GraphSnapshot,
	path: string,
	direction: Exclude<GraphDirection, "in">
): string[] {
	if (direction === "out") {
		return (snapshot.outgoing[path] ?? []).map((edge) => edge.to);
	}

	return [...new Set([...(snapshot.outgoing[path] ?? []).map((edge) => edge.to), ...(snapshot.incoming[path] ?? []).map((edge) => edge.from)])].sort(compareGraphPaths);
}

export function findShortestPath(input: ShortestPathInput): string[] | null {
	if (input.from === input.to) {
		return [input.from];
	}

	const previous = new Map<string, string>();
	const visited = new Set<string>([input.from]);
	const queue: string[] = [input.from];

	for (let index = 0; index < queue.length; index += 1) {
		const path = queue[index];
		if (!path) {
			continue;
		}

		for (const neighborPath of getNeighborPaths(input.snapshot, path, input.direction)) {
			if (visited.has(neighborPath)) {
				continue;
			}

			visited.add(neighborPath);
			previous.set(neighborPath, path);
			if (neighborPath === input.to) {
				const result = [input.to];
				let cursor = input.to;
				while (previous.has(cursor)) {
					const parent = previous.get(cursor);
					if (!parent) {
						break;
					}

					result.push(parent);
					cursor = parent;
				}

				return result.reverse();
			}

			queue.push(neighborPath);
		}
	}

	return null;
}
