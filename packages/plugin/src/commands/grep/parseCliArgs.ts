import type { CliData } from "obsidian";
import { normalizeGrepPathPrefix } from "../../settings";
import type { PluginCliParseResult } from "../types";
import type { GrepCliInput } from "./types";

function readFlag(params: CliData, hyphenated: string, camelCase: string): boolean {
	const value = params[hyphenated] ?? params[camelCase];
	return value === true || value === "true";
}

function readValue(params: CliData, hyphenated: string, camelCase: string): string | undefined {
	return params[hyphenated] ?? params[camelCase];
}

function readPathPrefixList(
	params: CliData,
	hyphenated: string,
	camelCase: string
): string[] | undefined {
	const value = readValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return undefined;
	}

	const prefixes = value
		.split(",")
		.map((entry) => normalizeGrepPathPrefix(entry))
		.filter((entry): entry is string => entry !== undefined);

	return prefixes.length > 0 ? prefixes : undefined;
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

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return `The --${hyphenated} option must be a non-negative integer.`;
	}

	return parsed;
}

export function parseGrepCliArgs(params: CliData): PluginCliParseResult<GrepCliInput> {
	const pattern = readValue(params, "pattern", "pattern");
	const pathPrefixes = readPathPrefixList(params, "path", "path");
	const excludePathPrefixes = readPathPrefixList(
		params,
		"exclude-path",
		"excludePath"
	);
	const maxResultsValue = readValue(params, "max-results", "maxResults");
	const beforeContext = readNonNegativeIntegerOption(params, "before-context", "beforeContext");
	if (typeof beforeContext === "string") {
		return { ok: false, message: beforeContext };
	}

	const afterContext = readNonNegativeIntegerOption(params, "after-context", "afterContext");
	if (typeof afterContext === "string") {
		return { ok: false, message: afterContext };
	}

	const context = readNonNegativeIntegerOption(params, "context", "context");
	if (typeof context === "string") {
		return { ok: false, message: context };
	}

	let maxResults: number | undefined;
	if (maxResultsValue !== undefined) {
		maxResults = Number.parseInt(maxResultsValue, 10);
		if (!Number.isInteger(maxResults) || maxResults <= 0) {
			return {
				ok: false,
				message: "The --max-results option must be a positive integer."
			};
		}
	}

	return {
		ok: true,
		value: {
			pattern,
			pathPrefix: pathPrefixes?.[0],
			pathPrefixes,
			excludePathPrefixes,
			fixedStrings: readFlag(params, "fixed-strings", "fixedStrings"),
			ignoreCase: readFlag(params, "ignore-case", "ignoreCase"),
			lineNumber: readFlag(params, "line-number", "lineNumber"),
			filesWithMatches: readFlag(params, "files-with-matches", "filesWithMatches"),
			count: readFlag(params, "count", "count"),
			beforeContext,
			afterContext,
			context,
			maxResults,
			stats: readFlag(params, "stats", "stats"),
			json: readFlag(params, "json", "json")
		}
	};
}
