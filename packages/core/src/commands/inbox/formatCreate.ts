import type { InboxCreateResult, InboxOutputFormat } from "./types";

export function formatCreate(result: InboxCreateResult, format: InboxOutputFormat): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (result.created) {
		return `Created: ${result.card.id}`;
	}

	return `Already exists (id=${result.card.id}, seenCount=${result.card.seenCount}): skipped.`;
}
