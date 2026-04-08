import type { SearchDocument } from "@sample/core";
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

export type VaultSourceOptions = {
	pathPrefix?: string;
	pathPrefixes?: string[];
	excludePathPrefixes?: string[];
};

type GrepPlugin = Plugin & { settings: SamplePluginSettings };

export function isVaultSearchTarget(input: {
	filePath: string;
	extension: string;
	configDir: string;
	pathPrefixes?: string[];
	excludePathPrefixes?: string[];
	targetExtensions: string[];
	permissionSettings: GrepPermissionSettings;
}): boolean {
	if (input.filePath.startsWith(`${input.configDir}/`)) {
		return false;
	}

	if (!input.targetExtensions.includes(input.extension.toLowerCase())) {
		return false;
	}

	if (!isPathAllowedByGrepPolicy(input.filePath, input.permissionSettings, input.configDir)) {
		return false;
	}

	if (
		input.excludePathPrefixes?.some((pathPrefix) =>
			pathMatchesPrefix(input.filePath, pathPrefix)
		)
	) {
		return false;
	}

	if (!input.pathPrefixes || input.pathPrefixes.length === 0) {
		return true;
	}

	return input.pathPrefixes.some((pathPrefix) => pathMatchesPrefix(input.filePath, pathPrefix));
}

export function buildVaultSource(
	plugin: GrepPlugin,
	options: VaultSourceOptions
): VaultSearchSource {
	let skippedCount = 0;
	const permissionSettings = plugin.settings.grepPermissionSettings;
	const pathPrefixes =
		options.pathPrefixes?.map((pathPrefix) => normalizeGrepPathPrefix(pathPrefix)).filter(
			(pathPrefix): pathPrefix is string => pathPrefix !== undefined
		) ??
		(options.pathPrefix ? [normalizeGrepPathPrefix(options.pathPrefix)].filter(Boolean) : []);
	const excludePathPrefixes =
		options.excludePathPrefixes
			?.map((pathPrefix) => normalizeGrepPathPrefix(pathPrefix))
			.filter((pathPrefix): pathPrefix is string => pathPrefix !== undefined) ?? [];

	return {
		documents: {
			async *[Symbol.asyncIterator]() {
				for (const file of plugin.app.vault.getFiles()) {
					if (
						!isVaultSearchTarget({
							filePath: file.path,
							extension: file.extension,
							configDir: file.vault.configDir,
							pathPrefixes,
							excludePathPrefixes,
							targetExtensions: permissionSettings.targetExtensions,
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
