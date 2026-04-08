import { normalizeConfigDirPathPrefix } from "./grepPolicy";

export type TemplateCommandSettings = {
	templateRoot: string;
	denyOutputPathPrefixes: string[];
	maxRenderedFiles: number;
};

export const DEFAULT_TEMPLATE_COMMAND_SETTINGS: TemplateCommandSettings = {
	templateRoot: "templates/",
	denyOutputPathPrefixes: [],
	maxRenderedFiles: 20
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizePathPrefix(input?: string): string | undefined {
	const normalized = input?.trim().replace(/^\/+|\/+$/g, "");
	return normalized ? `${normalized}/` : undefined;
}

function normalizePathPrefixList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => (typeof entry === "string" ? normalizePathPrefix(entry) : undefined))
		.filter((entry): entry is string => entry !== undefined);
}

export function resolveTemplateCommandSettings(value: unknown): TemplateCommandSettings {
	if (!isRecord(value)) {
		return DEFAULT_TEMPLATE_COMMAND_SETTINGS;
	}

	const templateRoot = normalizePathPrefix(
		typeof value.templateRoot === "string" ? value.templateRoot : undefined
	);
	const denyOutputPathPrefixes = normalizePathPrefixList(value.denyOutputPathPrefixes);
	const maxRenderedFiles =
		typeof value.maxRenderedFiles === "number" &&
		Number.isInteger(value.maxRenderedFiles) &&
		value.maxRenderedFiles > 0
			? value.maxRenderedFiles
			: DEFAULT_TEMPLATE_COMMAND_SETTINGS.maxRenderedFiles;

	return {
		templateRoot: templateRoot ?? DEFAULT_TEMPLATE_COMMAND_SETTINGS.templateRoot,
		denyOutputPathPrefixes:
			denyOutputPathPrefixes.length > 0
				? Array.from(new Set(denyOutputPathPrefixes))
				: DEFAULT_TEMPLATE_COMMAND_SETTINGS.denyOutputPathPrefixes,
		maxRenderedFiles
	};
}

function getEffectiveDenyOutputPathPrefixes(
	settings: TemplateCommandSettings,
	configDir?: string
): string[] {
	const configDirPathPrefix = normalizeConfigDirPathPrefix(configDir);
	return configDirPathPrefix
		? Array.from(new Set([configDirPathPrefix, ...settings.denyOutputPathPrefixes]))
		: settings.denyOutputPathPrefixes;
}

export function getTemplateOutputPathPolicyError(
	path: string,
	settings: TemplateCommandSettings,
	configDir?: string
): string | undefined {
	const normalized = path.replace(/^\/+/, "");
	const deniedPrefix = getEffectiveDenyOutputPathPrefixes(settings, configDir).find(
		(prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)
	);
	return deniedPrefix
		? `Rendered path "${normalized}" is denied by template output policy.`
		: undefined;
}
