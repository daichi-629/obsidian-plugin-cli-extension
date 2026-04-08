import type { Plugin } from "obsidian";
import {
	DEFAULT_GREP_PERMISSION_SETTINGS,
	resolveGrepPermissionSettings,
	type GrepPermissionSettings
} from "./grepPolicy";
import {
	DEFAULT_TEMPLATE_COMMAND_SETTINGS,
	resolveTemplateCommandSettings,
	type TemplateCommandSettings
} from "./templateCommand";

type StoredPluginSettings = {
	grepPermissionSettings?: unknown;
	templateCommandSettings?: unknown;
};

export type SamplePluginSettings = {
	grepPermissionSettings: GrepPermissionSettings;
	templateCommandSettings: TemplateCommandSettings;
};

export const DEFAULT_PLUGIN_SETTINGS: SamplePluginSettings = {
	grepPermissionSettings: DEFAULT_GREP_PERMISSION_SETTINGS,
	templateCommandSettings: DEFAULT_TEMPLATE_COMMAND_SETTINGS
};

export async function loadPluginSettings(plugin: Plugin): Promise<SamplePluginSettings> {
	const data = (await plugin.loadData()) as StoredPluginSettings | null;

	return {
		grepPermissionSettings: resolveGrepPermissionSettings(data?.grepPermissionSettings),
		templateCommandSettings: resolveTemplateCommandSettings(data?.templateCommandSettings)
	};
}

export async function savePluginSettings(
	plugin: Plugin,
	settings: SamplePluginSettings
): Promise<void> {
	await plugin.saveData({
		grepPermissionSettings: settings.grepPermissionSettings,
		templateCommandSettings: settings.templateCommandSettings
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
export type { TemplateCommandSettings } from "./templateCommand";
export {
	DEFAULT_TEMPLATE_COMMAND_SETTINGS,
	getTemplateOutputPathPolicyError,
	resolveTemplateCommandSettings
} from "./templateCommand";
