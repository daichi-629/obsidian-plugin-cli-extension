import { applyTokenBudget, resolveEmbeds, type BundleEntry } from "../../context-engine";
import type { ReadBulkCommandInput, ReadBulkResult } from "./types";

export async function executeReadBulk(input: ReadBulkCommandInput): Promise<ReadBulkResult> {
	const notes = input.scope.maxFiles ? input.notes.slice(0, input.scope.maxFiles) : input.notes;
	const entries: BundleEntry[] = [];

	for (const note of notes) {
		const resolved = input.scope.resolveEmbeds
			? await resolveEmbeds({
					note,
					embedDepth: input.scope.embedDepth,
					annotateEmbeds: input.scope.annotateEmbeds,
					loadNote: input.loadNote,
					resolveLinkpath: input.resolveLinkpath
				})
			: {
					content: note.rawContent,
					resolvedEmbeds: []
				};

		entries.push({
			path: note.path,
			name: note.name,
			relation: input.relation,
			frontmatter: note.frontmatter,
			content: resolved.content,
			truncated: false,
			resolvedEmbeds: resolved.resolvedEmbeds
		});
	}

	const budgeted = applyTokenBudget(entries, {
		maxChars: input.scope.maxChars,
		includeFrontmatter: input.scope.includeFrontmatter
	});

	return {
		includeFrontmatter: input.scope.includeFrontmatter,
		truncated: budgeted.truncated,
		notes: budgeted.entries
	};
}
