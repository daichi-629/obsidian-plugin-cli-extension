import { filterGraphScope, findWeakComponents } from "../../graph";
import type { TraverseClustersCommandInput, TraverseClustersResult } from "./types";

export function executeTraverseClusters(
	input: TraverseClustersCommandInput
): TraverseClustersResult {
	const minSize = input.minSize ?? 1;
	const scoped = filterGraphScope(input.snapshot, {
		folder: input.folder,
		tag: input.tag
	});
	const components = findWeakComponents(scoped.snapshot);
	const clusters = components
		.filter((component) => component.length >= minSize)
		.map((paths, index) => ({
			index,
			size: paths.length,
			paths
		}));

	return {
		mode: "clusters",
		scope: {
			folder: scoped.scope.folder,
			tag: scoped.scope.tag,
			noteCount: scoped.scope.noteCount,
			edgeCount: scoped.scope.edgeCount,
			componentCount: components.length,
			displayedComponentCount: clusters.length,
			minSize
		},
		clusters
	};
}
