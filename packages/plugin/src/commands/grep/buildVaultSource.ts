import type { SearchDocument, SearchOptions } from "@sample/core";
import type { Plugin } from "obsidian";
import type { SamplePluginSettings } from "../../settings";
import {
	isPathAllowedByGrepPolicy,
	normalizeGrepPathPrefix,
	pathMatchesPrefix,
	type GrepPermissionSettings
} from "../../settings";

export type VaultSearchSource = {
	documents: AsyncIterable<SearchDocument>;
	getSkippedCount(): number;
};

type GrepPlugin = Plugin & { settings: SamplePluginSettings };

const SUPPORTED_EXTENSIONS = new Set(["md", "txt"]);

export function isVaultSearchTarget(input: {
	filePath: string;
	extension: string;
	configDir: string;
	pathPrefix?: string;
	permissionSettings: GrepPermissionSettings;
}): boolean {
	if (input.filePath.startsWith(`${input.configDir}/`)) {
		return false;
	}

	if (!SUPPORTED_EXTENSIONS.has(input.extension)) {
		return false;
	}

	if (!isPathAllowedByGrepPolicy(input.filePath, input.permissionSettings)) {
		return false;
	}

	if (!input.pathPrefix) {
		return true;
	}

	return pathMatchesPrefix(input.filePath, input.pathPrefix);
}

export function buildVaultSource(
	plugin: GrepPlugin,
	options: Pick<SearchOptions, "pathPrefix">
): VaultSearchSource {
	let skippedCount = 0;
	const pathPrefix = normalizeGrepPathPrefix(options.pathPrefix);
	const permissionSettings = plugin.settings.grepPermissionSettings;

	return {
		documents: {
			async *[Symbol.asyncIterator]() {
				for (const file of plugin.app.vault.getFiles()) {
					if (
						!isVaultSearchTarget({
							filePath: file.path,
							extension: file.extension,
							configDir: file.vault.configDir,
							pathPrefix,
							permissionSettings
						})
					) {
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
