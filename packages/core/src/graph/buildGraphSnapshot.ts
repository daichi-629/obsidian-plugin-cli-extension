import type { GraphEdge, GraphNode, GraphSnapshot } from "./types";

function comparePaths(left: string, right: string): number {
	if (left < right) {
		return -1;
	}

	if (left > right) {
		return 1;
	}

	return 0;
}

function compareEdges(left: GraphEdge, right: GraphEdge): number {
	const fromOrder = comparePaths(left.from, right.from);
	if (fromOrder !== 0) {
		return fromOrder;
	}

	return comparePaths(left.to, right.to);
}

export function buildGraphSnapshot(nodes: GraphNode[], edges: GraphEdge[]): GraphSnapshot {
	const nodeMap = new Map<string, GraphNode>();
	for (const node of nodes) {
		if (!nodeMap.has(node.path)) {
			nodeMap.set(node.path, {
				...node,
				tags: [...node.tags].sort(comparePaths)
			});
		}
	}

	const sortedNodes = [...nodeMap.values()].sort((left, right) =>
		comparePaths(left.path, right.path)
	);
	const allowedPaths = new Set(sortedNodes.map((node) => node.path));
	const edgeMap = new Map<string, number>();

	for (const edge of edges) {
		if (edge.from === edge.to || !allowedPaths.has(edge.from) || !allowedPaths.has(edge.to)) {
			continue;
		}

		const linkCount =
			Number.isFinite(edge.linkCount) && edge.linkCount > 0 ? Math.trunc(edge.linkCount) : 0;
		if (linkCount <= 0) {
			continue;
		}

		const key = `${edge.from}\n${edge.to}`;
		edgeMap.set(key, (edgeMap.get(key) ?? 0) + linkCount);
	}

	const sortedEdges = [...edgeMap.entries()]
		.map(([key, linkCount]) => {
			const [from, to] = key.split("\n");
			return { from: from ?? "", to: to ?? "", linkCount };
		})
		.sort(compareEdges);

	const outgoing: Record<string, GraphEdge[]> = Object.create(null);
	const incoming: Record<string, GraphEdge[]> = Object.create(null);
	for (const node of sortedNodes) {
		outgoing[node.path] = [];
		incoming[node.path] = [];
	}

	for (const edge of sortedEdges) {
		outgoing[edge.from]?.push(edge);
		incoming[edge.to]?.push(edge);
	}

	return {
		nodes: sortedNodes,
		edges: sortedEdges,
		outgoing,
		incoming,
		meta: {
			noteCount: sortedNodes.length,
			edgeCount: sortedEdges.length
		}
	};
}

export function compareGraphPaths(left: string, right: string): number {
	return comparePaths(left, right);
}
