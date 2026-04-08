export type GrepPermissionSettings = {
	enabled: boolean;
	denyPathPrefixes: string[];
	allowPathPrefixes?: string[];
	targetExtensions: string[];
};

export const DEFAULT_GREP_PERMISSION_SETTINGS: GrepPermissionSettings = {
	enabled: true,
	denyPathPrefixes: ["templates/private/"],
	allowPathPrefixes: [],
	targetExtensions: ["md", "txt"]
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizePathPrefix(input?: string): string | undefined {
	const normalized = input?.trim().replace(/^\/+|\/+$/g, "");
	return normalized ? `${normalized}/` : undefined;
}

export function normalizeConfigDirPathPrefix(configDir?: string): string | undefined {
	return normalizePathPrefix(configDir);
}

function normalizePathPrefixList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => (typeof entry === "string" ? normalizePathPrefix(entry) : undefined))
		.filter((entry): entry is string => entry !== undefined);
}

function normalizeExtension(input?: string): string | undefined {
	const normalized = input?.trim().replace(/^\.+/, "").toLowerCase();
	return normalized ? normalized : undefined;
}

function normalizeExtensionList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => (typeof entry === "string" ? normalizeExtension(entry) : undefined))
		.filter((entry): entry is string => entry !== undefined);
}

export function normalizeGrepPathPrefix(input?: string): string | undefined {
	return normalizePathPrefix(input);
}

export function resolveGrepPermissionSettings(value: unknown): GrepPermissionSettings {
	if (!isRecord(value)) {
		return DEFAULT_GREP_PERMISSION_SETTINGS;
	}

	const denyPathPrefixes = normalizePathPrefixList(value.denyPathPrefixes);

	return {
		enabled:
			typeof value.enabled === "boolean"
				? value.enabled
				: DEFAULT_GREP_PERMISSION_SETTINGS.enabled,
		denyPathPrefixes:
			denyPathPrefixes.length > 0
				? denyPathPrefixes
				: DEFAULT_GREP_PERMISSION_SETTINGS.denyPathPrefixes,
		allowPathPrefixes: normalizePathPrefixList(value.allowPathPrefixes),
		targetExtensions: (() => {
			const targetExtensions = normalizeExtensionList(value.targetExtensions);
			return targetExtensions.length > 0
				? targetExtensions
				: DEFAULT_GREP_PERMISSION_SETTINGS.targetExtensions;
		})()
	};
}

export function pathMatchesPrefix(path: string, pathPrefix: string): boolean {
	return path === pathPrefix.slice(0, -1) || path.startsWith(pathPrefix);
}

function getEffectiveDenyPathPrefixes(
	settings: GrepPermissionSettings,
	configDir?: string
): string[] {
	const configDirPathPrefix = normalizeConfigDirPathPrefix(configDir);
	return configDirPathPrefix
		? [configDirPathPrefix, ...settings.denyPathPrefixes]
		: [...settings.denyPathPrefixes];
}

function getEffectiveAllowPathPrefixes(settings: GrepPermissionSettings): string[] {
	return settings.enabled ? (settings.allowPathPrefixes ?? []) : [];
}

export function isPathAllowedByGrepPolicy(
	path: string,
	settings: GrepPermissionSettings,
	configDir?: string
): boolean {
	if (
		getEffectiveDenyPathPrefixes(settings, configDir).some((prefix) =>
			pathMatchesPrefix(path, prefix)
		)
	) {
		return false;
	}

	const allowPathPrefixes = getEffectiveAllowPathPrefixes(settings);
	if (allowPathPrefixes.length === 0) {
		return true;
	}

	return allowPathPrefixes.some((prefix) => pathMatchesPrefix(path, prefix));
}

export function getGrepPathPolicyError(
	pathPrefix: string | undefined,
	settings: GrepPermissionSettings,
	configDir?: string
): string | undefined {
	if (!pathPrefix) {
		return undefined;
	}

	const deniedPrefix = getEffectiveDenyPathPrefixes(settings, configDir).find((prefix) =>
		pathMatchesPrefix(pathPrefix, prefix)
	);
	if (deniedPrefix) {
		return `Access to path "${pathPrefix}" is denied by grep policy.`;
	}

	const allowPathPrefixes = getEffectiveAllowPathPrefixes(settings);
	if (
		allowPathPrefixes.length > 0 &&
		!allowPathPrefixes.some((prefix) => pathMatchesPrefix(pathPrefix, prefix))
	) {
		return `Path "${pathPrefix}" is outside the allowed grep scope.`;
	}

	return undefined;
}

export function getGrepPathPolicyErrorForMany(
	pathPrefixes: string[],
	settings: GrepPermissionSettings,
	configDir?: string
): string | undefined {
	for (const pathPrefix of pathPrefixes) {
		const error = getGrepPathPolicyError(pathPrefix, settings, configDir);
		if (error) {
			return error;
		}
	}

	return undefined;
}
