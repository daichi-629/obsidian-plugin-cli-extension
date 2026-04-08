import { UserError } from "../../shared/errors/userError";
import { filterGraphScope, findShortestPath } from "../../graph";
import type { GraphSnapshot } from "../../graph";
import type {
	TraversePathCommandInput,
	TraversePathFoundResult,
	TraversePathResult
} from "./types";

function getNodeName(path: string): string {
	const basename = path.split("/").pop() ?? path;
	return basename.endsWith(".md") ? basename.slice(0, -".md".length) : basename;
}

function getPathEdges(snapshot: GraphSnapshot, paths: string[]): TraversePathFoundResult["edges"] {
	const edges: TraversePathFoundResult["edges"] = [];
	for (let index = 0; index < paths.length - 1; index += 1) {
		const from = paths[index];
		const to = paths[index + 1];
		if (!from || !to) {
			continue;
		}

		const direct =
			snapshot.outgoing[from]?.find((edge) => edge.to === to) ??
			snapshot.outgoing[to]?.find((edge) => edge.to === from);
		if (direct) {
			edges.push({
				from: direct.from,
				to: direct.to,
				linkCount: direct.linkCount
			});
		}
	}

	return edges;
}

export function executeTraversePath(input: TraversePathCommandInput): TraversePathResult {
	const direction = input.direction ?? "out";
	const scoped = filterGraphScope(input.snapshot, {
		folder: input.folder,
		tag: input.tag
	});

	if (!scoped.snapshot.nodes.some((node) => node.path === input.from)) {
		throw new UserError(`The start note is outside the selected graph scope: ${input.from}`);
	}

	if (!scoped.snapshot.nodes.some((node) => node.path === input.to)) {
		throw new UserError(`The target note is outside the selected graph scope: ${input.to}`);
	}

	const path = findShortestPath({
		snapshot: scoped.snapshot,
		from: input.from,
		to: input.to,
		direction
	});

	if (path === null) {
		return {
			mode: "path",
			found: false,
			scope: {
				from: input.from,
				to: input.to,
				folder: scoped.scope.folder,
				tag: scoped.scope.tag,
				direction,
				noteCount: scoped.scope.noteCount,
				edgeCount: scoped.scope.edgeCount
			}
		};
	}

	return {
		mode: "path",
		found: true,
		scope: {
			from: input.from,
			to: input.to,
			folder: scoped.scope.folder,
			tag: scoped.scope.tag,
			direction,
			noteCount: scoped.scope.noteCount,
			edgeCount: scoped.scope.edgeCount
		},
		hops: Math.max(path.length - 1, 0),
		nodes: path.map((nodePath, index) => ({
			index,
			path: nodePath,
			name: getNodeName(nodePath)
		})),
		edges: getPathEdges(scoped.snapshot, path)
	};
}
