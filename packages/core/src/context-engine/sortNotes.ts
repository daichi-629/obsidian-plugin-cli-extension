import type { ContextNoteCatalogEntry } from "./types";

export type ContextNoteSort = "path" | "mtime" | "size";

function comparePaths(left: string, right: string): number {
	return left.localeCompare(right);
}

export function dedupeInputPaths(paths: string[]): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const path of paths) {
		if (seen.has(path)) {
			continue;
		}
		seen.add(path);
		ordered.push(path);
	}
	return ordered;
}

export function sortCatalogNotes(
	notes: ContextNoteCatalogEntry[],
	sort: ContextNoteSort
): ContextNoteCatalogEntry[] {
	return [...notes].sort((left, right) => {
		if (sort === "mtime") {
			if (left.mtimeMs !== right.mtimeMs) {
				return right.mtimeMs - left.mtimeMs;
			}
			return comparePaths(left.path, right.path);
		}

		if (sort === "size") {
			if (left.sizeBytes !== right.sizeBytes) {
				return right.sizeBytes - left.sizeBytes;
			}
			return comparePaths(left.path, right.path);
		}

		return comparePaths(left.path, right.path);
	});
}
