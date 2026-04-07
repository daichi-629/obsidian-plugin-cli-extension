import type { SearchInput, SearchOptions } from "./types";

export function parseSearchOptions(input: SearchInput): SearchOptions {
	const pattern = input.pattern?.trim();

	if (!pattern) {
		throw new Error("The --pattern option is required.");
	}

	if (input.filesWithMatches && input.count) {
		throw new Error("The --files-with-matches and --count options cannot be used together.");
	}

	if (
		input.maxResults !== undefined &&
		(!Number.isInteger(input.maxResults) || input.maxResults <= 0)
	) {
		throw new Error("The --max-results option must be a positive integer.");
	}

	return {
		pattern,
		pathPrefix: input.pathPrefix,
		fixedStrings: input.fixedStrings ?? false,
		ignoreCase: input.ignoreCase ?? false,
		lineNumber: input.lineNumber ?? false,
		filesWithMatches: input.filesWithMatches ?? false,
		count: input.count ?? false,
		maxResults: input.maxResults
	};
}
