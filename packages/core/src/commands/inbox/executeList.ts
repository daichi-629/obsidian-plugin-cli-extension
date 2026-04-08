import type { InboxCardSummary, InboxListResult, SuggestionCard } from "./types";

const PRIORITY_ORDER: Record<SuggestionCard["priority"], number> = {
	high: 0,
	medium: 1,
	low: 2
};

export type ListInput = {
	status: SuggestionCard["status"][];
	kind: SuggestionCard["kind"] | null;
	priority: SuggestionCard["priority"] | null;
	limit: number | null;
};

export function executeList(cards: SuggestionCard[], input: ListInput): InboxListResult {
	let filtered = cards.filter((c) => input.status.includes(c.status));

	if (input.kind !== null) {
		filtered = filtered.filter((c) => c.kind === input.kind);
	}

	if (input.priority !== null) {
		filtered = filtered.filter((c) => c.priority === input.priority);
	}

	filtered.sort((a, b) => {
		const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
		if (priorityDiff !== 0) return priorityDiff;
		return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
	});

	const limited = input.limit !== null ? filtered.slice(0, input.limit) : filtered;

	const summaries: InboxCardSummary[] = limited.map((c) => ({
		id: c.id,
		status: c.status,
		kind: c.kind,
		priority: c.priority,
		title: c.title,
		createdAt: c.createdAt,
		seenCount: c.seenCount
	}));

	return {
		filter: {
			status: input.status,
			kind: input.kind,
			priority: input.priority,
			limit: input.limit
		},
		totalCount: cards.length,
		displayedCount: summaries.length,
		cards: summaries
	};
}
