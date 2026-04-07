import type { SearchDocument, SearchOptions } from "@sample/core";
import { TFile, type Plugin } from "obsidian";

export type VaultSearchSource = {
	documents: AsyncIterable<SearchDocument>;
	getSkippedCount(): number;
};

const SUPPORTED_EXTENSIONS = new Set(["md", "txt"]);

function normalizePathPrefix(pathPrefix?: string): string | undefined {
	const normalized = pathPrefix?.replace(/^\/+|\/+$/g, "");
	return normalized ? `${normalized}/` : undefined;
}

function isSearchTarget(file: TFile, pathPrefix?: string): boolean {
	const configDirPrefix = `${file.vault.configDir}/`;
	if (file.path.startsWith(configDirPrefix)) {
		return false;
	}

	if (!SUPPORTED_EXTENSIONS.has(file.extension)) {
		return false;
	}

	if (!pathPrefix) {
		return true;
	}

	return file.path === pathPrefix.slice(0, -1) || file.path.startsWith(pathPrefix);
}

export function buildVaultSource(
	plugin: Plugin,
	options: Pick<SearchOptions, "pathPrefix">
): VaultSearchSource {
	let skippedCount = 0;
	const pathPrefix = normalizePathPrefix(options.pathPrefix);

	return {
		documents: {
			async *[Symbol.asyncIterator]() {
				for (const file of plugin.app.vault.getFiles()) {
					if (!isSearchTarget(file, pathPrefix)) {
						continue;
					}

					try {
						const content = await plugin.app.vault.cachedRead(file);
						yield {
							path: file.path,
							content
						};
					} catch {
						skippedCount += 1;
					}
				}
			}
		},
		getSkippedCount() {
			return skippedCount;
		}
	};
}
