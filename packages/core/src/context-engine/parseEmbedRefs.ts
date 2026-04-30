import type { ParsedEmbedRef } from "./types";

function parseSection(input: string): {
	linkpath: string;
	kind: ParsedEmbedRef["section"]["kind"];
	value: string | null;
} {
	const hashIndex = input.indexOf("#");
	if (hashIndex === -1) {
		return {
			linkpath: input.trim(),
			kind: "whole-note",
			value: null
		};
	}

	const linkpath = input.slice(0, hashIndex).trim();
	const suffix = input.slice(hashIndex + 1).trim();
	if (suffix.startsWith("^")) {
		return {
			linkpath,
			kind: "block",
			value: suffix.slice(1).trim() || null
		};
	}

	return {
		linkpath,
		kind: "heading",
		value: suffix || null
	};
}

export function parseEmbedRefs(content: string): ParsedEmbedRef[] {
	const refs: ParsedEmbedRef[] = [];
	const pattern = /!\[\[([^\]]+)\]\]/g;

	for (const match of content.matchAll(pattern)) {
		const raw = match[0];
		const ref = (match[1] ?? "").trim();
		if (!raw || ref.length === 0 || match.index === undefined) {
			continue;
		}

		const section = parseSection(ref);
		refs.push({
			raw,
			ref,
			linkpath: section.linkpath,
			section: {
				kind: section.kind,
				value: section.value
			},
			index: match.index,
			length: raw.length
		});
	}

	return refs;
}
