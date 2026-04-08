import type { CachedMetadata, FrontMatterCache, Plugin } from "obsidian";
import type { VaultSchemaSnapshot } from "@sample/core";

function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

function coerceScalar(value: string): unknown {
	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	if (value === "null") {
		return null;
	}

	if (/^-?\d+$/.test(value)) {
		return Number.parseInt(value, 10);
	}

	if (/^-?\d*\.\d+$/.test(value)) {
		return Number.parseFloat(value);
	}

	return value.replace(/^['"]|['"]$/g, "");
}

function parseFrontmatterBlock(content: string): Record<string, unknown> {
	if (!content.startsWith("---\n")) {
		return {};
	}

	const lines = content.split(/\r?\n/);
	if (lines[0] !== "---") {
		return {};
	}

	let index = 1;
	const frontmatter: Record<string, unknown> = {};
	let currentListKey: string | null = null;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		index += 1;
		if (line === "---") {
			break;
		}

		if (/^\s*-\s+/.test(line) && currentListKey) {
			const value = line.replace(/^\s*-\s+/, "").trim();
			const current = frontmatter[currentListKey];
			if (Array.isArray(current)) {
				current.push(String(coerceScalar(value)));
			}
			continue;
		}

		const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
		if (!match) {
			currentListKey = null;
			continue;
		}

		const key = match[1] ?? "";
		const rawValue = (match[2] ?? "").trim();
		if (rawValue.length === 0) {
			frontmatter[key] = [];
			currentListKey = key;
			continue;
		}

		if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
			frontmatter[key] = rawValue
				.slice(1, -1)
				.split(",")
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0)
				.map((entry) => String(coerceScalar(entry)));
			currentListKey = null;
			continue;
		}

		frontmatter[key] = coerceScalar(rawValue);
		currentListKey = null;
	}

	return frontmatter;
}

function normalizeTag(tag: string): string {
	return tag.replace(/^#+/, "");
}

function normalizeStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.filter((entry): entry is string => typeof entry === "string")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
			.sort((left, right) => left.localeCompare(right));
	}

	if (typeof value === "string") {
		return value
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0)
			.sort((left, right) => left.localeCompare(right));
	}

	return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPropertyType(value: unknown): string | null {
	if (!isRecord(value) || typeof value.type !== "string") {
		return null;
	}

	return value.type;
}

function normalizeFrontmatter(frontmatter: FrontMatterCache | undefined): Record<string, unknown> {
	if (!isRecord(frontmatter)) {
		return {};
	}

	const entries = Object.entries(frontmatter).filter(([key]) => key !== "position");
	const normalized: Record<string, unknown> = Object.fromEntries(entries);

	if ("tags" in normalized) {
		normalized.tags = normalizeStringArray(normalized.tags);
	}

	if ("aliases" in normalized) {
		normalized.aliases = normalizeStringArray(normalized.aliases);
	}

	return normalized;
}

function mergeFrontmatter(
	cachedFrontmatter: FrontMatterCache | undefined,
	parsedFrontmatter: Record<string, unknown>
): Record<string, unknown> {
	const cached = normalizeFrontmatter(cachedFrontmatter);
	return Object.keys(cached).length > 0 ? cached : normalizeFrontmatter(parsedFrontmatter);
}

function getFolder(path: string): string {
	const slashIndex = path.lastIndexOf("/");
	return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function readCatalog(
	metadataCache: Plugin["app"]["metadataCache"]
): VaultSchemaSnapshot["propertyCatalog"] {
	const reader = (metadataCache as { getAllPropertyInfos?: () => unknown }).getAllPropertyInfos;
	if (typeof reader !== "function") {
		return {};
	}

	const raw = reader.call(metadataCache);
	if (!raw || typeof raw !== "object") {
		return {};
	}

	if (raw instanceof Map) {
		return Object.fromEntries(
			[...raw.entries()].map(([key, value]) => [
				String(key),
				{
					obsidianType: readPropertyType(value)
				}
			])
		);
	}

	return Object.fromEntries(
		Object.entries(raw).map(([key, value]) => [
			key,
			{
				obsidianType: readPropertyType(value)
			}
		])
	);
}

function extractTags(cache: CachedMetadata | null): string[] {
	return [
		...new Set((cache?.tags ?? []).map((tag) => normalizeTag(tag.tag)).filter(Boolean))
	].sort((left, right) => left.localeCompare(right));
}

function extractTagsFromFrontmatter(frontmatter: Record<string, unknown>): string[] {
	return normalizeStringArray(frontmatter.tags).map((tag) => normalizeTag(tag));
}

export async function buildVaultSchemaSnapshot(plugin: Plugin): Promise<VaultSchemaSnapshot> {
	const configDir = plugin.app.vault.configDir;
	const files = plugin.app.vault
		.getMarkdownFiles()
		.filter((file) => file.path !== configDir && !file.path.startsWith(`${configDir}/`))
		.sort((left, right) => left.path.localeCompare(right.path));

	const notes = await Promise.all(
		files.map(async (file) => {
			const normalizedPath = normalizeVaultPath(file.path);
			const cache = plugin.app.metadataCache.getFileCache(file);
			const content =
				cache?.frontmatter && Object.keys(cache.frontmatter).length > 0
					? ""
					: await plugin.app.vault.cachedRead(file);
			const parsedFrontmatter = content.length > 0 ? parseFrontmatterBlock(content) : {};
			const frontmatter = mergeFrontmatter(cache?.frontmatter, parsedFrontmatter);
			const tags = extractTags(cache);
			return {
				path: normalizedPath,
				folder: getFolder(normalizedPath),
				tags: tags.length > 0 ? tags : extractTagsFromFrontmatter(frontmatter),
				frontmatter
			};
		})
	);

	return {
		propertyCatalog: readCatalog(plugin.app.metadataCache),
		notes
	};
}
