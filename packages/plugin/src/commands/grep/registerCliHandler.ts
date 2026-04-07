import {
	formatSearchResult,
	parseSearchOptions,
	searchDocuments
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import { buildVaultSource } from "./buildVaultSource";
import { parseGrepCliArgs } from "./parseCliArgs";

const CLI_FLAGS = {
	pattern: {
		value: "<pattern>",
		description: "Search pattern.",
		required: true
	},
	path: {
		value: "<vault-path-prefix>",
		description: "Limit the search to a vault-relative path prefix."
	},
	"fixed-strings": {
		description: "Treat the pattern as a fixed substring."
	},
	"ignore-case": {
		description: "Match case-insensitively."
	},
	"line-number": {
		description: "Include 1-based line numbers in output."
	},
	"files-with-matches": {
		description: "Only print paths with at least one match."
	},
	count: {
		description: "Print the number of matches per file."
	},
	"max-results": {
		value: "<number>",
		description: "Stop after this many matches."
	}
};

function formatSkippedWarning(skippedFiles: number): string {
	return skippedFiles === 1
		? "(1 file skipped due to read error)"
		: `(${skippedFiles} files skipped due to read error)`;
}

export function registerGrepCliHandler(plugin: Plugin): void {
	const handler: CliHandler = async (params) => {
		const parsedArgs = parseGrepCliArgs(params);
		if (!parsedArgs.ok) {
			return parsedArgs.message;
		}

		let options;
		try {
			options = parseSearchOptions(parsedArgs.value);
		} catch (error) {
			return error instanceof Error ? error.message : "Failed to parse grep options.";
		}

		try {
			const source = buildVaultSource(plugin, options);
			const result = await searchDocuments(source.documents, options);
			result.skippedFiles = source.getSkippedCount();

			const output = formatSearchResult(result, options);
			if (result.skippedFiles === 0) {
				return output;
			}

			return `${output}\n${formatSkippedWarning(result.skippedFiles)}`;
		} catch (error) {
			return error instanceof Error ? error.message : "Vault grep failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		"sample-monorepo-plugin-grep",
		"Search markdown and text files in the current vault.",
		CLI_FLAGS,
		handler
	);
}
