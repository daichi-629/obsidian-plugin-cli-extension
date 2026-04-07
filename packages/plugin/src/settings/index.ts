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

export async function savePluginSettings(
	plugin: Plugin,
	settings: SamplePluginSettings
): Promise<void> {
	await plugin.saveData({
		grepPermissionSettings: settings.grepPermissionSettings
	} satisfies StoredPluginSettings);
}

export type { GrepPermissionSettings } from "./grepPolicy";
export {
	DEFAULT_GREP_PERMISSION_SETTINGS,
	getGrepPathPolicyError,
	getGrepPathPolicyErrorForMany,
	isPathAllowedByGrepPolicy,
	normalizeGrepPathPrefix,
	pathMatchesPrefix,
	resolveGrepPermissionSettings
} from "./grepPolicy";
