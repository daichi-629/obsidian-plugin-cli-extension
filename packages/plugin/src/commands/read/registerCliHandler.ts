import {
	dedupeInputPaths,
	runReadBulkCommand,
	sortCatalogNotes,
	UserError,
	type ContextNoteCatalogEntry,
	type ReadBulkCommandInput
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import { buildVaultNoteCatalog, loadVaultNotes, resolveEmbedTarget } from "../../context-engine";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import { parseReadBulkCliArgs } from "./parseCliArgs";
import { readBulkCommandSpec } from "./spec";

function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

function normalizeFolder(folder: string | undefined): string | undefined {
	if (folder === undefined) {
		return undefined;
	}

	return normalizePath(folder);
}

function normalizeTag(tag: string | undefined): string | undefined {
	return tag?.replace(/^#+/, "").trim() || undefined;
}

function pathMatchesFolder(path: string, folder: string): boolean {
	if (folder.length === 0) {
		return true;
	}

	return path === folder || path.startsWith(`${folder}/`);
}

function selectScopedPaths(
	catalog: ContextNoteCatalogEntry[],
	input: { folder?: string; tag?: string; sort: "path" | "mtime" | "size"; maxFiles?: number }
): string[] {
	const folder = normalizeFolder(input.folder);
	const tag = normalizeTag(input.tag);
	const filtered = catalog.filter((note) => {
		if (folder && !pathMatchesFolder(note.folder, folder) && note.folder !== folder) {
			return false;
		}

		if (tag && !note.tags.includes(tag)) {
			return false;
		}

		return true;
	});

	const sorted = sortCatalogNotes(filtered, input.sort);
	const limited = input.maxFiles ? sorted.slice(0, input.maxFiles) : sorted;
	return limited.map((note) => note.path);
}

async function buildReadBulkInput(
	plugin: Plugin,
	params: Parameters<CliHandler>[0]
): Promise<ReadBulkCommandInput | string> {
	const parsed = parseReadBulkCliArgs(params);
	if (!parsed.ok) {
		return parsed.message;
	}

	const catalog = buildVaultNoteCatalog(plugin);
	const catalogMap = new Map(catalog.map((note) => [note.path, note]));
	const explicitPaths = dedupeInputPaths(parsed.value.paths.map((path) => normalizePath(path)));
	const selectedExplicitPaths =
		explicitPaths.length > 0 && parsed.value.maxFiles
			? explicitPaths.slice(0, parsed.value.maxFiles)
			: explicitPaths;
	const selectedPaths =
		explicitPaths.length > 0
			? selectedExplicitPaths
			: selectScopedPaths(catalog, {
					folder: parsed.value.folder,
					tag: parsed.value.tag,
					sort: parsed.value.sort ?? "path",
					maxFiles: parsed.value.maxFiles
				});

	if (explicitPaths.length > 0) {
		const missingPath = selectedExplicitPaths.find((path) => !catalogMap.has(path));
		if (missingPath) {
			return `The note does not exist in the vault: ${missingPath}`;
		}
	}

	const notes = await loadVaultNotes(plugin, selectedPaths);

	return {
		scope: {
			paths: explicitPaths.length > 0 ? explicitPaths : null,
			folder:
				explicitPaths.length === 0 ? (normalizeFolder(parsed.value.folder) ?? null) : null,
			tag: explicitPaths.length === 0 ? (normalizeTag(parsed.value.tag) ?? null) : null,
			sort: explicitPaths.length > 0 ? "input" : (parsed.value.sort ?? "path"),
			maxFiles: parsed.value.maxFiles ?? null,
			maxChars: parsed.value.maxChars ?? null,
			includeFrontmatter: parsed.value.includeFrontmatter,
			resolveEmbeds: parsed.value.resolveEmbeds,
			embedDepth: parsed.value.embedDepth ?? 3,
			annotateEmbeds: parsed.value.annotateEmbeds
		},
		notes,
		relation: explicitPaths.length > 0 ? "explicit" : "scoped",
		format: parsed.value.format,
		loadNote: async (path) => {
			const [note] = await loadVaultNotes(plugin, [path]);
			return note ?? null;
		},
		resolveLinkpath: (linkpath, sourcePath) => resolveEmbedTarget(plugin, linkpath, sourcePath)
	};
}

export function registerReadBulkCliHandler(plugin: Plugin): void {
	const handler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(readBulkCommandSpec);
		}

		try {
			const input = await buildReadBulkInput(plugin, params);
			return typeof input === "string" ? input : runReadBulkCommand(input);
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Read bulk failed unexpectedly: ${error.message}`
				: "Read bulk failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		readBulkCommandSpec.name,
		readBulkCommandSpec.summary,
		buildCliFlags(readBulkCommandSpec),
		handler
	);
}
