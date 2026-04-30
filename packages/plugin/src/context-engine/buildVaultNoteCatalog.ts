import type { ContextNoteCatalogEntry } from "@sample/core";
import type { CachedMetadata, Plugin } from "obsidian";
import { isVaultConfigPath, normalizeVaultPath } from "./vaultPath";

function comparePaths(left: string, right: string): number {
	return left.localeCompare(right);
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
	return tag.replace(/^#+/, "").trim();
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

export function buildVaultNoteCatalog(plugin: Plugin): ContextNoteCatalogEntry[] {
	const configDir = normalizeVaultPath(plugin.app.vault.configDir);
	return plugin.app.vault
		.getMarkdownFiles()
		.filter((file) => !isVaultConfigPath(file.path, configDir))
		.map((file) => {
			const path = normalizeVaultPath(file.path);
			const cache = plugin.app.metadataCache.getFileCache(file);
			return {
				path,
				name: getName(path),
				folder: getFolder(path),
				tags: extractTags(cache),
				mtimeMs: file.stat.mtime,
				sizeBytes: file.stat.size
			};
		});
}
