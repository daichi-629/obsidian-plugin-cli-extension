import { formatMarkdownBundle } from "../../context-engine";
import type { ReadBulkOutputFormat, ReadBulkResult } from "./types";

export function formatReadBulkResult(result: ReadBulkResult, format: ReadBulkOutputFormat): string {
	if (format === "json") {
		return JSON.stringify(
			{
				notes: result.notes.map((note) => ({
					path: note.path,
					relation: note.relation,
					frontmatter: result.includeFrontmatter ? note.frontmatter : null,
					content: note.content,
					truncated: note.truncated,
					resolvedEmbeds: note.resolvedEmbeds
				})),
				truncated: result.truncated
			},
			null,
			2
		);
	}

	if (format === "tsv") {
		return [
			"path\trelation\ttruncated",
			...result.notes.map(
				(note) => `${note.path}\t${note.relation}\t${String(note.truncated)}`
			)
		].join("\n");
	}

	return formatMarkdownBundle({
		entries: result.notes,
		includeFrontmatter: result.includeFrontmatter,
		truncated: result.truncated
	});
}
