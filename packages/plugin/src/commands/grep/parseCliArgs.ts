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

export function parseGrepCliArgs(params: CliData): PluginCliParseResult<GrepCliInput> {
	const pattern = readValue(params, "pattern", "pattern");
	const pathPrefix = normalizeGrepPathPrefix(readValue(params, "path", "path"));
	const maxResultsValue = readValue(params, "max-results", "maxResults");

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
			pathPrefix,
			fixedStrings: readFlag(params, "fixed-strings", "fixedStrings"),
			ignoreCase: readFlag(params, "ignore-case", "ignoreCase"),
			lineNumber: readFlag(params, "line-number", "lineNumber"),
			filesWithMatches: readFlag(params, "files-with-matches", "filesWithMatches"),
			count: readFlag(params, "count", "count"),
			maxResults
		}
	};
}
