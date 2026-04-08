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
import {
	DEFAULT_INBOX_SETTINGS,
	resolveInboxSettings,
	type InboxSettings
} from "../inbox/inboxSettings";

type StoredPluginSettings = {
	grepPermissionSettings?: unknown;
	templateCommandSettings?: unknown;
	inboxStore?: unknown;
	inboxSettings?: unknown;
};

export type SamplePluginSettings = {
	grepPermissionSettings: GrepPermissionSettings;
	templateCommandSettings: TemplateCommandSettings;
	inboxSettings: InboxSettings;
};

export const DEFAULT_PLUGIN_SETTINGS: SamplePluginSettings = {
	grepPermissionSettings: DEFAULT_GREP_PERMISSION_SETTINGS,
	templateCommandSettings: DEFAULT_TEMPLATE_COMMAND_SETTINGS,
	inboxSettings: DEFAULT_INBOX_SETTINGS
};

export async function loadPluginSettings(plugin: Plugin): Promise<SamplePluginSettings> {
	const data = (await plugin.loadData()) as StoredPluginSettings | null;

	return {
		grepPermissionSettings: resolveGrepPermissionSettings(data?.grepPermissionSettings),
		templateCommandSettings: resolveTemplateCommandSettings(data?.templateCommandSettings),
		inboxSettings: resolveInboxSettings(data?.inboxSettings)
	};
}

export async function savePluginSettings(
	plugin: Plugin,
	settings: SamplePluginSettings
): Promise<void> {
	const existing = ((await plugin.loadData()) as Record<string, unknown> | null) ?? {};
	await plugin.saveData({
		...existing,
		grepPermissionSettings: settings.grepPermissionSettings,
		templateCommandSettings: settings.templateCommandSettings,
		inboxSettings: settings.inboxSettings
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
export type { InboxSettings } from "../inbox/inboxSettings";
export { DEFAULT_INBOX_SETTINGS, resolveInboxSettings } from "../inbox/inboxSettings";
