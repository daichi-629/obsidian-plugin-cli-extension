import { normalizeGrepPathPrefix } from "./grepPolicy";

export function parsePathPrefixLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => normalizeGrepPathPrefix(line))
		.filter((line): line is string => line !== undefined);
}

export function formatPathPrefixLines(prefixes: string[]): string {
	return prefixes.join("\n");
}

export function parseExtensionLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim().replace(/^\.+/, "").toLowerCase())
		.filter((line) => line.length > 0);
}

export function formatExtensionLines(extensions: string[]): string {
	return extensions.join("\n");
}
