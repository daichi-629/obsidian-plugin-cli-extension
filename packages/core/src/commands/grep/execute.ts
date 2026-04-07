import { compileSearchPattern, searchText } from "./searchText";
import type { SearchDocument, SearchOptions, SearchResult } from "./types";

export async function searchDocuments(
	documents: Iterable<SearchDocument> | AsyncIterable<SearchDocument>,
	options: SearchOptions
): Promise<SearchResult> {
	const pattern = compileSearchPattern(options);
	let totalMatches = 0;
	const result: SearchResult = {
		matches: [],
		filesScanned: 0,
		matchedFiles: 0,
		skippedFiles: 0,
		stoppedEarly: false
	};

	for await (const document of documents) {
		result.filesScanned += 1;

		const matches = searchText(document, options, pattern);
		if (matches.length === 0) {
			continue;
		}

		result.matchedFiles += 1;

		if (options.filesWithMatches) {
			totalMatches += matches.length;
			result.matches.push({ path: document.path, text: "" });
		} else if (options.count) {
			let countedMatches = 0;
			for (let index = 0; index < matches.length; index += 1) {
				totalMatches += 1;
				countedMatches += 1;
				if (
					options.maxResults !== undefined &&
					totalMatches >= options.maxResults
				) {
					result.matches.push({ path: document.path, text: String(countedMatches) });
					result.stoppedEarly = true;
					return result;
				}
			}

			result.matches.push({ path: document.path, text: String(countedMatches) });
		} else {
			for (const match of matches) {
				totalMatches += 1;
				result.matches.push(match);
				if (
					options.maxResults !== undefined &&
					totalMatches >= options.maxResults
				) {
					result.stoppedEarly = true;
					return result;
				}
			}
			continue;
		}

		if (options.maxResults !== undefined && totalMatches >= options.maxResults) {
			result.stoppedEarly = true;
			return result;
		}
	}

	return result;
}
