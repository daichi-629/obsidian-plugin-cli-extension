export function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

export function isVaultConfigPath(path: string, configDir: string): boolean {
	const normalizedPath = normalizeVaultPath(path);
	const normalizedConfigDir = normalizeVaultPath(configDir);
	return (
		normalizedPath === normalizedConfigDir ||
		normalizedPath.startsWith(`${normalizedConfigDir}/`)
	);
}
