import {
	compileSearchPattern,
	findMatchingLines,
	splitDocumentLines,
	type SearchLine
} from "./searchText";
import type { SearchDocument, SearchMatch, SearchOptions, SearchResult } from "./types";

function buildContextMatches(
	document: SearchDocument,
	lines: SearchLine[],
	matchingLines: SearchLine[],
	options: SearchOptions
): SearchMatch[] {
	const included = new Map<number, SearchMatch>();

	for (const match of matchingLines) {
		const start = Math.max(1, match.line - options.beforeContext);
		const end = Math.min(lines.length, match.line + options.afterContext);

		for (let lineNumber = start; lineNumber <= end; lineNumber += 1) {
			const line = lines[lineNumber - 1];
			if (!line) {
				continue;
			}

			const kind = lineNumber === match.line ? "match" : "context";
			const previous = included.get(lineNumber);
			if (previous?.kind === "match") {
				continue;
			}

			included.set(lineNumber, {
				path: document.path,
				line: line.line,
				text: line.text,
				kind
			});
		}
	}

	return [...included.entries()]
		.sort(([left], [right]) => left - right)
		.map(([, value]) => value);
}

export async function searchDocuments(
	documents: Iterable<SearchDocument> | AsyncIterable<SearchDocument>,
	options: SearchOptions
): Promise<SearchResult> {
	const pattern = compileSearchPattern(options);
	const result: SearchResult = {
		matches: [],
		filesScanned: 0,
		matchedFiles: 0,
		skippedFiles: 0,
		stoppedEarly: false,
		totalMatches: 0
	};

	for await (const document of documents) {
		result.filesScanned += 1;

		const lines = splitDocumentLines(document.content);
		const matchingLines = findMatchingLines(lines, pattern);
		if (matchingLines.length === 0) {
			continue;
		}

		result.matchedFiles += 1;
		const remainingMatches =
			options.maxResults === undefined ? undefined : options.maxResults - result.totalMatches;
		const limitedMatchingLines =
			remainingMatches === undefined
				? matchingLines
				: matchingLines.slice(0, Math.max(remainingMatches, 0));

		result.totalMatches += limitedMatchingLines.length;

		if (options.filesWithMatches) {
			result.matches.push({ path: document.path, text: "" });
		} else if (options.count) {
			result.matches.push({
				path: document.path,
				text: String(limitedMatchingLines.length)
			});
		} else if (options.beforeContext > 0 || options.afterContext > 0) {
			result.matches.push(
				...buildContextMatches(document, lines, limitedMatchingLines, options)
			);
		} else {
			result.matches.push(
				...limitedMatchingLines.map((match) => ({
					path: document.path,
					line: options.lineNumber ? match.line : undefined,
					text: match.text,
					kind: "match" as const
				}))
			);
		}

		if (
			options.maxResults !== undefined &&
			(result.totalMatches >= options.maxResults ||
				limitedMatchingLines.length < matchingLines.length)
		) {
			result.stoppedEarly = true;
			return result;
		}
	}

	return result;
}
