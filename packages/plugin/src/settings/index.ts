import type { Plugin } from "obsidian";
import {
	DEFAULT_GREP_PERMISSION_SETTINGS,
	resolveGrepPermissionSettings,
	type GrepPermissionSettings
} from "./grepPolicy";

type StoredPluginSettings = {
	grepPermissionSettings?: unknown;
};

export type SamplePluginSettings = {
	grepPermissionSettings: GrepPermissionSettings;
};

export const DEFAULT_PLUGIN_SETTINGS: SamplePluginSettings = {
	grepPermissionSettings: DEFAULT_GREP_PERMISSION_SETTINGS
};

export async function loadPluginSettings(plugin: Plugin): Promise<SamplePluginSettings> {
	const data = (await plugin.loadData()) as StoredPluginSettings | null;

	return {
		grepPermissionSettings: resolveGrepPermissionSettings(data?.grepPermissionSettings)
	};
}

export type { GrepPermissionSettings } from "./grepPolicy";
export {
	DEFAULT_GREP_PERMISSION_SETTINGS,
	getGrepPathPolicyError,
	isPathAllowedByGrepPolicy,
	normalizeGrepPathPrefix,
	pathMatchesPrefix,
	resolveGrepPermissionSettings
} from "./grepPolicy";
