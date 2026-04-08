import { buildGraphSnapshot } from "./buildGraphSnapshot";
import type { GraphScopeFilter, GraphSnapshot } from "./types";

function normalizeFolder(folder: string | null | undefined): string | null {
	if (folder === undefined || folder === null) {
		return null;
	}

	const normalized = folder
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
	return normalized.length === 0 ? null : normalized;
}

function normalizeTag(tag: string | null | undefined): string | null {
	if (tag === undefined || tag === null) {
		return null;
	}

	const normalized = tag.replace(/^#+/, "").trim();
	return normalized.length === 0 ? null : normalized;
}

function matchesFolder(path: string, folder: string | null): boolean {
	if (folder === null) {
		return true;
	}

	return path === folder || path.startsWith(`${folder}/`);
}

export function filterGraphScope(
	snapshot: GraphSnapshot,
	filter: GraphScopeFilter
): {
	snapshot: GraphSnapshot;
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
		edgeCount: number;
	};
} {
	const folder = normalizeFolder(filter.folder);
	const tag = normalizeTag(filter.tag);
	const nodes = snapshot.nodes.filter((node) => {
		if (!matchesFolder(node.folder, folder)) {
			return false;
		}

		return tag === null || node.tags.includes(tag);
	});
	const allowedPaths = new Set(nodes.map((node) => node.path));
	const edges = snapshot.edges.filter(
		(edge) => allowedPaths.has(edge.from) && allowedPaths.has(edge.to)
	);
	const scopedSnapshot = buildGraphSnapshot(nodes, edges);

	return {
		snapshot: scopedSnapshot,
		scope: {
			folder,
			tag,
			noteCount: scopedSnapshot.meta.noteCount,
			edgeCount: scopedSnapshot.meta.edgeCount
		}
	};
}
