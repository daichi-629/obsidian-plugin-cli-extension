import { compareGraphPaths } from "./buildGraphSnapshot";
import type { GraphSnapshot } from "./types";

function getNeighborPaths(snapshot: GraphSnapshot, path: string): string[] {
	return [
		...new Set([
			...(snapshot.outgoing[path] ?? []).map((edge) => edge.to),
			...(snapshot.incoming[path] ?? []).map((edge) => edge.from)
		])
	].sort(compareGraphPaths);
}

export function findWeakComponents(snapshot: GraphSnapshot): string[][] {
	const visited = new Set<string>();
	const components: string[][] = [];

	for (const node of snapshot.nodes) {
		if (visited.has(node.path)) {
			continue;
		}

		const queue = [node.path];
		const component: string[] = [];
		visited.add(node.path);

		for (let index = 0; index < queue.length; index += 1) {
			const path = queue[index];
			if (!path) {
				continue;
			}

			component.push(path);
			for (const neighborPath of getNeighborPaths(snapshot, path)) {
				if (visited.has(neighborPath)) {
					continue;
				}

				visited.add(neighborPath);
				queue.push(neighborPath);
			}
		}

		component.sort(compareGraphPaths);
		components.push(component);
	}

	return components.sort(
		(left, right) =>
			right.length - left.length || compareGraphPaths(left[0] ?? "", right[0] ?? "")
	);
}
