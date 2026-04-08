import { UserError } from "../../shared/errors/userError";
import { computeReachability, filterGraphScope } from "../../graph";
import type { TraverseReachCommandInput, TraverseReachResult } from "./types";

function getNodeName(path: string): string {
	const basename = path.split("/").pop() ?? path;
	return basename.endsWith(".md") ? basename.slice(0, -".md".length) : basename;
}

export function executeTraverseReach(input: TraverseReachCommandInput): TraverseReachResult {
	const direction = input.direction ?? "out";
	const depth = input.depth ?? 2;
	const scoped = filterGraphScope(input.snapshot, {
		folder: input.folder,
		tag: input.tag
	});

	if (!scoped.snapshot.nodes.some((node) => node.path === input.from)) {
		throw new UserError(`The seed note is outside the selected graph scope: ${input.from}`);
	}

	const reachable = computeReachability({
		snapshot: scoped.snapshot,
		from: input.from,
		depth,
		direction
	});

	return {
		mode: "reach",
		scope: {
			from: input.from,
			folder: scoped.scope.folder,
			tag: scoped.scope.tag,
			direction,
			depth,
			noteCount: scoped.scope.noteCount,
			edgeCount: scoped.scope.edgeCount
		},
		result: {
			noteCount: reachable.nodes.length,
			edgeCount: reachable.edges.length
		},
		nodes: reachable.nodes.map((node) => ({
			...node,
			name: getNodeName(node.path)
		})),
		edges: reachable.edges.map((edge) => ({ ...edge }))
	};
}
