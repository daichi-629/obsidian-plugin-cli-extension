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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isLinkEntry(value: unknown): value is { link: string } {
	return isRecord(value) && typeof value.link === "string";
}

function readResolvedTargets(
	value: unknown,
	from: string,
	markdownPaths: Set<string>
): Array<{ to: string; linkCount: number }> {
	if (!isRecord(value)) {
		return [];
	}

	const targets: Array<{ to: string; linkCount: number }> = [];
	for (const [targetPath, linkCount] of Object.entries(value)) {
		const to = normalizePath(targetPath);
		if (
			from === to ||
			!markdownPaths.has(to) ||
			typeof linkCount !== "number" ||
			!Number.isFinite(linkCount) ||
			linkCount <= 0
		) {
			continue;
		}

		targets.push({
			to,
			linkCount: Math.trunc(linkCount)
		});
	}

	return targets.sort((left, right) => comparePaths(left.to, right.to));
}

function readCacheLinkEntries(cache: CachedMetadata | null): string[] {
	const entries = [
		...((cache?.links ?? []).filter(isLinkEntry).map((entry) => entry.link) ?? []),
		...((cache?.embeds ?? []).filter(isLinkEntry).map((entry) => entry.link) ?? [])
	];

	return entries
		.map((entry) => entry.trim())
		.filter(Boolean)
		.sort(comparePaths);
}

function readFallbackTargets(input: {
	plugin: Plugin;
	from: string;
	cache: CachedMetadata | null;
	markdownPaths: Set<string>;
}): Array<{ to: string; linkCount: number }> {
	const resolver = (
		input.plugin.app.metadataCache as {
			getFirstLinkpathDest?: (
				linkpath: string,
				sourcePath: string
			) => { path?: string } | null;
		}
	).getFirstLinkpathDest;
	if (typeof resolver !== "function") {
		return [];
	}

	const counts = new Map<string, number>();
	for (const linkpath of readCacheLinkEntries(input.cache)) {
		const resolved = resolver.call(input.plugin.app.metadataCache, linkpath, input.from);
		const to = normalizePath(resolved?.path ?? "");
		if (to.length === 0 || to === input.from || !input.markdownPaths.has(to)) {
			continue;
		}

		counts.set(to, (counts.get(to) ?? 0) + 1);
	}

	return [...counts.entries()]
		.map(([to, linkCount]) => ({ to, linkCount }))
		.sort((left, right) => comparePaths(left.to, right.to));
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
	const cachesByPath = new Map(
		files.map((file) => [normalizePath(file.path), plugin.app.metadataCache.getFileCache(file)])
	);

	const markdownPaths = new Set(nodes.map((node) => node.path));
	const edges: GraphEdge[] = [];
	for (const from of [...markdownPaths].sort(comparePaths)) {
		const resolvedTargets = readResolvedTargets(
			plugin.app.metadataCache.resolvedLinks?.[from],
			from,
			markdownPaths
		);
		const targets =
			resolvedTargets.length > 0
				? resolvedTargets
				: readFallbackTargets({
						plugin,
						from,
						cache: cachesByPath.get(from) ?? null,
						markdownPaths
					});

		for (const target of targets) {
			edges.push({
				from,
				to: target.to,
				linkCount: target.linkCount
			});
		}
	}

	return buildGraphSnapshot(nodes, edges);
}
