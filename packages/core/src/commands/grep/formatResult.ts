import type { SearchOptions, SearchResult } from "./types";

function hasContext(options: SearchOptions): boolean {
	return options.beforeContext > 0 || options.afterContext > 0;
}

function formatStats(result: SearchResult): string {
	return [
		"Stats:",
		`filesScanned=${result.filesScanned}`,
		`matchedFiles=${result.matchedFiles}`,
		`skippedFiles=${result.skippedFiles}`,
		`totalMatches=${result.totalMatches}`,
		`stoppedEarly=${result.stoppedEarly}`
	].join("\n");
}

export function formatSearchResult(result: SearchResult, options: SearchOptions): string {
	if (options.json) {
		return JSON.stringify(result, null, 2);
	}

	const body =
		result.matches.length === 0
			? "No matches found."
			: result.matches
					.map((match) => {
						if (options.count) {
							return `${match.path}:${match.text}`;
						}

						if (options.filesWithMatches) {
							return match.path;
						}

						const separator = match.kind === "context" ? "-" : ":";
						const shouldShowLineNumber = options.lineNumber || hasContext(options);
						if (shouldShowLineNumber && match.line !== undefined) {
							return `${match.path}${separator}${match.line}${separator}${match.text}`;
						}

						return `${match.path}${separator}${match.text}`;
					})
					.join("\n");

	if (!options.stats) {
		return body;
	}

	return `${body}\n${formatStats(result)}`;
}
