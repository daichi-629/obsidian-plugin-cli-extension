import type { CompiledSearchPattern, SearchDocument, SearchMatch, SearchOptions } from "./types";

export function compileSearchPattern(options: SearchOptions): CompiledSearchPattern {
	if (options.fixedStrings) {
		const needle = options.ignoreCase ? options.pattern.toLocaleLowerCase() : options.pattern;
		return {
			test(input: string) {
				const haystack = options.ignoreCase ? input.toLocaleLowerCase() : input;
				return haystack.includes(needle);
			}
		};
	}

	let regex: RegExp;
	try {
		regex = new RegExp(options.pattern, options.ignoreCase ? "i" : "");
	} catch {
		throw new Error(`Invalid regular expression: ${options.pattern}`);
	}

	return {
		test(input: string) {
			return regex.test(input);
		}
	};
}

export function searchText(
	document: SearchDocument,
	options: SearchOptions,
	pattern: CompiledSearchPattern
): SearchMatch[] {
	const lines = document.content.split(/\r?\n/);
	const matches: SearchMatch[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (!pattern.test(line)) {
			continue;
		}

		matches.push({
			path: document.path,
			line: options.lineNumber ? index + 1 : undefined,
			text: line
		});
	}

	return matches;
}
