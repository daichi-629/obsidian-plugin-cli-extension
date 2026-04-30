import type { LoadedContextNote } from "@sample/core";
import { UserError } from "@sample/core";
import type { FrontMatterCache, Plugin } from "obsidian";
import { isVaultConfigPath, normalizeVaultPath } from "./vaultPath";

function getFolder(path: string): string {
	const slashIndex = path.lastIndexOf("/");
	return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function getName(path: string): string {
	const basename = path.split("/").pop() ?? path;
	return basename.endsWith(".md") ? basename.slice(0, -".md".length) : basename;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeFrontmatter(frontmatter: FrontMatterCache | Record<string, unknown> | undefined) {
	if (!isRecord(frontmatter)) {
		return {};
	}

	const normalized = Object.fromEntries(
		Object.entries(frontmatter).filter(([key]) => key !== "position")
	);
	if ("tags" in normalized) {
		normalized.tags = normalizeStringArray(normalized.tags);
	}
	if ("aliases" in normalized) {
		normalized.aliases = normalizeStringArray(normalized.aliases);
	}
	return normalized;
}

function parseFrontmatterBlock(content: string): Record<string, unknown> {
	if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
		return {};
	}

	const lines = content.split(/\r?\n/);
	if (lines[0] !== "---") {
		return {};
	}

	const frontmatter: Record<string, unknown> = {};
	let index = 1;
	let currentListKey: string | null = null;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		index += 1;
		if (line === "---") {
			break;
		}

		if (/^\s*-\s+/.test(line) && currentListKey) {
			const rawValue = line.replace(/^\s*-\s+/, "").trim();
			const current = frontmatter[currentListKey];
			if (Array.isArray(current)) {
				current.push(coerceScalar(rawValue));
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
				.map((entry) => coerceScalar(entry));
			currentListKey = null;
			continue;
		}

		frontmatter[key] = coerceScalar(rawValue);
		currentListKey = null;
	}

	return frontmatter;
}

function extractBodyWithoutFrontmatter(content: string): string {
	if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
		return content;
	}

	const lines = content.split(/\r?\n/);
	if (lines[0] !== "---") {
		return content;
	}

	for (let index = 1; index < lines.length; index += 1) {
		if (lines[index] === "---") {
			return lines
				.slice(index + 1)
				.join("\n")
				.replace(/^\n+/, "");
		}
	}

	return content;
}

function mergeFrontmatter(
	cachedFrontmatter: FrontMatterCache | undefined,
	content: string
): Record<string, unknown> | null {
	const normalizedCached = normalizeFrontmatter(cachedFrontmatter);
	if (Object.keys(normalizedCached).length > 0) {
		return normalizedCached;
	}

	const parsed = normalizeFrontmatter(parseFrontmatterBlock(content));
	return Object.keys(parsed).length > 0 ? parsed : null;
}

type NoteFileLike = {
	path: string;
	stat: {
		mtime: number;
		size: number;
	};
};

function buildFileMap(plugin: Plugin): Map<string, NoteFileLike> {
	const configDir = plugin.app.vault.configDir;
	return new Map(
		plugin.app.vault
			.getMarkdownFiles()
			.filter((file) => !isVaultConfigPath(file.path, configDir))
			.map((file) => [normalizeVaultPath(file.path), file as NoteFileLike])
	);
}

export async function loadVaultNotes(
	plugin: Plugin,
	paths: string[]
): Promise<LoadedContextNote[]> {
	const fileMap = buildFileMap(plugin);
	return Promise.all(
		paths.map(async (path) => {
			const normalizedPath = normalizeVaultPath(path);
			const file = fileMap.get(normalizedPath);
			if (!file) {
				throw new UserError(`The note does not exist in the vault: ${normalizedPath}`);
			}

			const fullContent = await plugin.app.vault.cachedRead(file as never);
			const cache = plugin.app.metadataCache.getFileCache(file as never);
			return {
				path: normalizedPath,
				name: getName(normalizedPath),
				folder: getFolder(normalizedPath),
				tags: [],
				frontmatter: mergeFrontmatter(cache?.frontmatter, fullContent),
				rawContent: extractBodyWithoutFrontmatter(fullContent),
				mtimeMs: file.stat.mtime,
				sizeBytes: file.stat.size
			};
		})
	);
}
