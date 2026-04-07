import type { CompiledSearchPattern, SearchOptions } from "./types";

export type SearchLine = {
	line: number;
	text: string;
};

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

export function splitDocumentLines(content: string): SearchLine[] {
	return content.split(/\r?\n/).map((text, index) => ({
		line: index + 1,
		text
	}));
}

export function findMatchingLines(
	lines: SearchLine[],
	pattern: CompiledSearchPattern
): SearchLine[] {
	return lines.filter((line) => pattern.test(line.text));
}
