import type { SearchOptions, SearchResult } from "./types";

export function formatSearchResult(result: SearchResult, options: SearchOptions): string {
	if (result.matches.length === 0) {
		return "No matches found.";
	}

	return result.matches
		.map((match) => {
			if (options.filesWithMatches) {
				return match.path;
			}

			if (options.count) {
				return `${match.path}:${match.text}`;
			}

			if (options.lineNumber && match.line !== undefined) {
				return `${match.path}:${match.line}:${match.text}`;
			}

			return `${match.path}:${match.text}`;
		})
		.join("\n");
}
