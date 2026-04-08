import { generateCardId } from "./generateCardId";
import { generateFingerprint } from "./generateFingerprint";
import type { InboxCreateResult, SuggestionCard } from "./types";

export type CreateInput = {
	kind: SuggestionCard["kind"];
	title: string;
	summary: string;
	relatedPaths: string[];
	priority: SuggestionCard["priority"];
	source: string;
	fingerprint?: string;
	now: Date;
	dismissCooldownDays: number;
};

export function executeCreate(
	cards: SuggestionCard[],
	input: CreateInput
): { cards: SuggestionCard[]; result: InboxCreateResult } {
	const fp = input.fingerprint ?? generateFingerprint(input.source, input.title);
	const existing = cards.find((c) => c.fingerprint === fp);

	if (existing) {
		if (existing.status === "open" || existing.status === "snoozed") {
			const updated: SuggestionCard = {
				...existing,
				seenCount: existing.seenCount + 1,
				updatedAt: input.now.toISOString()
			};
			const nextCards = cards.map((c) => (c.id === existing.id ? updated : c));
			return {
				cards: nextCards,
				result: { created: false, reason: "duplicate_open", card: updated }
			};
		}

		if (existing.status === "dismissed") {
			const dismissedAt = existing.dismissedAt ? new Date(existing.dismissedAt) : null;
			const cooldownMs = input.dismissCooldownDays * 24 * 60 * 60 * 1000;
			const withinCooldown =
				dismissedAt !== null && input.now.getTime() - dismissedAt.getTime() < cooldownMs;

			if (withinCooldown) {
				const updated: SuggestionCard = {
					...existing,
					seenCount: existing.seenCount + 1,
					updatedAt: input.now.toISOString()
				};
				const nextCards = cards.map((c) => (c.id === existing.id ? updated : c));
				return {
					cards: nextCards,
					result: {
						created: false,
						reason: "duplicate_dismissed_cooldown",
						card: updated
					}
				};
			}
		}

		// status=done or dismissed past cooldown → create new card
	}

	const newCard: SuggestionCard = {
		id: generateCardId(input.now),
		status: "open",
		kind: input.kind,
		priority: input.priority,
		title: input.title,
		summary: input.summary,
		source: { command: input.source, runAt: input.now.toISOString() },
		relatedPaths: input.relatedPaths,
		fingerprint: fp,
		seenCount: 1,
		createdAt: input.now.toISOString(),
		updatedAt: input.now.toISOString()
	};

	return {
		cards: [...cards, newCard],
		result: { created: true, card: newCard }
	};
}
