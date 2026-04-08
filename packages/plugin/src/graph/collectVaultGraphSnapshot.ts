import { buildGraphSnapshot, type GraphEdge, type GraphNode } from "@sample/core";
import type { CachedMetadata, Plugin } from "obsidian";

function comparePaths(left: string, right: string): number {
	if (left < right) {
		return -1;
	}

	if (left > right) {
		return 1;
	}

	return 0;
}

function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

function getFolder(path: string): string {
	const slashIndex = path.lastIndexOf("/");
	return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function getName(path: string): string {
	const basename = path.split("/").pop() ?? path;
	return basename.endsWith(".md") ? basename.slice(0, -".md".length) : basename;
}

function normalizeTag(tag: string): string {
	return tag.replace(/^#+/, "");
}

function normalizeStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	if (typeof value === "string") {
		return value
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	return [];
}

function extractTags(cache: CachedMetadata | null): string[] {
	const inlineTags = (cache?.tags ?? []).map((tag) => normalizeTag(tag.tag));
	const frontmatterTags = normalizeStringArray(cache?.frontmatter?.tags).map((tag) =>
		normalizeTag(tag)
	);
	return [...new Set([...inlineTags, ...frontmatterTags].filter(Boolean))].sort(comparePaths);
}

function isConfigPath(path: string, configDir: string): boolean {
	return path === configDir || path.startsWith(`${configDir}/`);
}

export function collectVaultGraphSnapshot(plugin: Plugin) {
	const configDir = normalizePath(plugin.app.vault.configDir);
	const files = plugin.app.vault
		.getMarkdownFiles()
		.filter((file) => !isConfigPath(file.path, configDir))
		.sort((left, right) => comparePaths(left.path, right.path));

	const nodes: GraphNode[] = files.map((file) => {
		const path = normalizePath(file.path);
		const cache = plugin.app.metadataCache.getFileCache(file);
		const tags = extractTags(cache);
		return {
			path,
			name: getName(path),
			folder: getFolder(path),
			tags
		};
	});

	const markdownPaths = new Set(nodes.map((node) => node.path));
	const edges: GraphEdge[] = [];
	for (const [sourcePath, targets] of Object.entries(plugin.app.metadataCache.resolvedLinks)) {
		const from = normalizePath(sourcePath);
		if (!markdownPaths.has(from)) {
			continue;
		}

		for (const [targetPath, linkCount] of Object.entries(targets ?? {})) {
			const to = normalizePath(targetPath);
			if (from === to || !markdownPaths.has(to)) {
				continue;
			}

			edges.push({
				from,
				to,
				linkCount
			});
		}
	}

	return buildGraphSnapshot(nodes, edges);
}
