import type { SearchInput, SearchOptions } from "./types";

function resolveContextValue(context: number | undefined, directional: number | undefined): number {
	if (directional !== undefined) {
		return directional;
	}

	return context ?? 0;
}

export function parseSearchOptions(input: SearchInput): SearchOptions {
	const pattern = input.pattern?.trim();

	if (!pattern) {
		throw new Error("The --pattern option is required.");
	}

	if (
		input.maxResults !== undefined &&
		(!Number.isInteger(input.maxResults) || input.maxResults <= 0)
	) {
		throw new Error("The --max-results option must be a positive integer.");
	}

	for (const [key, value] of [
		["context", input.context],
		["before-context", input.beforeContext],
		["after-context", input.afterContext]
	] as const) {
		if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
			throw new Error(`The --${key} option must be a non-negative integer.`);
		}
	}

	return {
		pattern,
		pathPrefix: input.pathPrefix,
		fixedStrings: input.fixedStrings ?? false,
		ignoreCase: input.ignoreCase ?? false,
		lineNumber: input.lineNumber ?? false,
		filesWithMatches: input.filesWithMatches ?? false,
		count: input.count ?? false,
		beforeContext: resolveContextValue(input.context, input.beforeContext),
		afterContext: resolveContextValue(input.context, input.afterContext),
		maxResults: input.maxResults,
		stats: input.stats ?? false,
		json: input.json ?? false
	};
}
