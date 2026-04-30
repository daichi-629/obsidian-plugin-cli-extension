import type { CliData } from "obsidian";
import type { PluginCliParseResult } from "../types";
import type { ReadBulkCliInput } from "./types";

function getParamValue(params: CliData, hyphenated: string, camelCase: string): unknown {
	const record = params as Record<string, unknown>;
	return record[hyphenated] ?? record[camelCase];
}

function readFlag(params: CliData, hyphenated: string, camelCase: string): boolean {
	const value = getParamValue(params, hyphenated, camelCase);
	return value === true || value === "true" || value === "";
}

function readValue(params: CliData, hyphenated: string, camelCase: string): string | undefined {
	const value = getParamValue(params, hyphenated, camelCase);
	return typeof value === "string" ? value : undefined;
}

function normalizeTagValue(tag: string): string {
	return tag.replace(/^#+/, "").trim();
}

function normalizeFolderValue(folder: string): string {
	return folder
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

function readList(params: CliData, hyphenated: string, camelCase: string): string[] {
	const value = getParamValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return [];
	}

	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === "string");
	}

	return typeof value === "string" ? [value] : [];
}

function parseJsonStringArray(value: string): string[] | null {
	if (!value.trim().startsWith("[")) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")
			? parsed
			: [];
	} catch {
		return [];
	}
}

function splitCommaSeparatedPaths(value: string): string[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parsePathSelectorValue(
	value: string,
	optionKey: "path" | "paths"
): { ok: true; values: string[] } | { ok: false; message: string } {
	const parsedJsonArray = parseJsonStringArray(value);
	if (parsedJsonArray !== null) {
		return parsedJsonArray.length > 0 || value.trim() === "[]"
			? { ok: true, values: parsedJsonArray }
			: {
					ok: false,
					message:
						optionKey === "path"
							? "The path option must be a string path or a JSON array of string paths."
							: "The --paths option must be a comma-separated string or a JSON array of string paths."
				};
	}

	return {
		ok: true,
		values: optionKey === "paths" ? splitCommaSeparatedPaths(value) : [value]
	};
}

function readExplicitPathSelectors(
	params: CliData
): { ok: true; values: string[] } | { ok: false; message: string } {
	const selectors: string[] = [];

	for (const value of readList(params, "path", "path")) {
		const parsed = parsePathSelectorValue(value, "path");
		if (!parsed.ok) {
			return parsed;
		}
		selectors.push(...parsed.values);
	}

	for (const value of readList(params, "paths", "paths")) {
		const parsed = parsePathSelectorValue(value, "paths");
		if (!parsed.ok) {
			return parsed;
		}
		selectors.push(...parsed.values);
	}

	return { ok: true, values: selectors };
}

function readPositiveIntegerOption(
	params: CliData,
	hyphenated: string,
	camelCase: string
): number | undefined | string {
	const value = readValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return undefined;
	}

	const normalized = value.trim();
	if (!/^[1-9]\d*$/.test(normalized)) {
		return `The --${hyphenated} option must be a positive integer.`;
	}

	return Number.parseInt(normalized, 10);
}

function readNonNegativeIntegerOption(
	params: CliData,
	hyphenated: string,
	camelCase: string
): number | undefined | string {
	const value = readValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return undefined;
	}

	const normalized = value.trim();
	if (!/^(0|[1-9]\d*)$/.test(normalized)) {
		return `The --${hyphenated} option must be a non-negative integer.`;
	}

	return Number.parseInt(normalized, 10);
}

function hasAnyValue(params: CliData, keys: string[]): boolean {
	const record = params as Record<string, unknown>;
	return keys.some((key) => record[key] !== undefined);
}

export function parseReadBulkCliArgs(params: CliData): PluginCliParseResult<ReadBulkCliInput> {
	const explicitPaths = readExplicitPathSelectors(params);
	if (!explicitPaths.ok) {
		return explicitPaths;
	}
	const paths = explicitPaths.values;

	const folder = readValue(params, "folder", "folder");
	const tag = readValue(params, "tag", "tag");
	if (folder !== undefined && normalizeFolderValue(folder).length === 0) {
		return {
			ok: false,
			message: "The --folder option must not be empty."
		};
	}
	if (tag !== undefined && normalizeTagValue(tag).length === 0) {
		return {
			ok: false,
			message: "The --tag option must not be empty."
		};
	}

	if (paths.length > 0 && (folder !== undefined || tag !== undefined)) {
		return {
			ok: false,
			message:
				"The bulk command accepts either path selectors or folder/tag selectors, not both."
		};
	}

	if (paths.length === 0 && folder === undefined && tag === undefined) {
		return {
			ok: false,
			message:
				"The bulk command requires at least one path=<path>, paths=<path[,path...]>, folder=<path>, or tag=<tag>."
		};
	}

	const sort = readValue(params, "sort", "sort");
	if (sort !== undefined && sort !== "path" && sort !== "mtime" && sort !== "size") {
		return {
			ok: false,
			message: "The --sort option must be path, mtime, or size."
		};
	}

	if (paths.length > 0 && sort !== undefined) {
		return {
			ok: false,
			message: "The --sort option is only valid for folder/tag selection."
		};
	}

	const maxFiles = readPositiveIntegerOption(params, "max-files", "maxFiles");
	if (typeof maxFiles === "string") {
		return { ok: false, message: maxFiles };
	}

	const maxChars = readPositiveIntegerOption(params, "max-char", "maxChar");
	if (typeof maxChars === "string") {
		return { ok: false, message: maxChars };
	}

	const resolveEmbeds = readFlag(params, "resolve-embeds", "resolveEmbeds");
	const embedDepth = readNonNegativeIntegerOption(params, "embed-depth", "embedDepth");
	if (typeof embedDepth === "string") {
		return { ok: false, message: embedDepth };
	}

	const annotateEmbeds = readFlag(params, "annotate-embeds", "annotateEmbeds");
	if (
		!resolveEmbeds &&
		hasAnyValue(params, ["embed-depth", "embedDepth", "annotate-embeds", "annotateEmbeds"])
	) {
		return {
			ok: false,
			message: "The --embed-depth and --annotate-embeds options require --resolve-embeds."
		};
	}

	const format = readValue(params, "format", "format") ?? "markdown";
	if (format !== "markdown" && format !== "json" && format !== "tsv") {
		return {
			ok: false,
			message: "The --format option must be markdown, json, or tsv."
		};
	}

	return {
		ok: true,
		value: {
			paths,
			folder: folder === undefined ? undefined : normalizeFolderValue(folder),
			tag,
			sort,
			maxFiles,
			maxChars,
			includeFrontmatter: readFlag(params, "include-frontmatter", "includeFrontmatter"),
			resolveEmbeds,
			embedDepth,
			annotateEmbeds,
			format
		}
	};
}
