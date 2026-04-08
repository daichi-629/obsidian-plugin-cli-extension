import type { SuggestionCard } from "./types";

export type UpdateInput = {
	id: string;
	status?: SuggestionCard["status"];
	kind?: SuggestionCard["kind"];
	priority?: SuggestionCard["priority"];
	title?: string;
	summary?: string;
	snoozedUntil?: string;
	now: Date;
};

export function executeUpdate(
	cards: SuggestionCard[],
	input: UpdateInput
): { cards: SuggestionCard[]; updated: SuggestionCard | null } {
	const existing = cards.find((c) => c.id === input.id);
	if (!existing) {
		return { cards, updated: null };
	}

	const patch: Partial<SuggestionCard> = { updatedAt: input.now.toISOString() };

	if (input.status !== undefined) {
		patch.status = input.status;

		if (input.status === "dismissed") {
			patch.dismissedAt = input.now.toISOString();
		}

		if (input.status === "snoozed" && input.snoozedUntil !== undefined) {
			patch.snoozedUntil = input.snoozedUntil;
		}

		// Clearing snoozedUntil when transitioning away from snoozed
		if (input.status !== "snoozed" && existing.status === "snoozed") {
			patch.snoozedUntil = undefined;
		}
	} else if (input.snoozedUntil !== undefined) {
		// Updating snoozedUntil on an already-snoozed card without changing status
		patch.snoozedUntil = input.snoozedUntil;
	}

	if (input.kind !== undefined) patch.kind = input.kind;
	if (input.priority !== undefined) patch.priority = input.priority;
	if (input.title !== undefined) patch.title = input.title;
	if (input.summary !== undefined) patch.summary = input.summary;

	const updated: SuggestionCard = { ...existing, ...patch };
	const nextCards = cards.map((c) => (c.id === input.id ? updated : c));

	return { cards: nextCards, updated };
}
