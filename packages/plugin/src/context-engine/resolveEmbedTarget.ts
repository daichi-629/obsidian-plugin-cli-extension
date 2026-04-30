import type { Plugin } from "obsidian";
import { isVaultConfigPath, normalizeVaultPath } from "./vaultPath";

export function resolveEmbedTarget(
	plugin: Plugin,
	linkpath: string,
	sourcePath: string
): string | null {
	const resolver = (
		plugin.app.metadataCache as {
			getFirstLinkpathDest?: (
				linkpath: string,
				sourcePath: string
			) => { path?: string } | null;
		}
	).getFirstLinkpathDest;

	if (typeof resolver !== "function") {
		return null;
	}

	const resolved = resolver.call(plugin.app.metadataCache, linkpath, sourcePath);
	if (typeof resolved?.path !== "string" || resolved.path.length === 0) {
		return null;
	}

	const normalizedPath = normalizeVaultPath(resolved.path);
	return isVaultConfigPath(normalizedPath, plugin.app.vault.configDir) ? null : normalizedPath;
}
