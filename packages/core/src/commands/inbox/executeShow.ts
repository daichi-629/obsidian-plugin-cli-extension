import type { SuggestionCard } from "./types";

export function executeShow(cards: SuggestionCard[], id: string): SuggestionCard | null {
	return cards.find((c) => c.id === id) ?? null;
}
