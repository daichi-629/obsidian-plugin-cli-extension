import type { SuggestionCard } from "./types";

export function executeDelete(
	cards: SuggestionCard[],
	id: string
): { cards: SuggestionCard[]; deleted: boolean } {
	const exists = cards.some((c) => c.id === id);
	if (!exists) {
		return { cards, deleted: false };
	}

	return { cards: cards.filter((c) => c.id !== id), deleted: true };
}
