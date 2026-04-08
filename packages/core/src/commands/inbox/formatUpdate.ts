import type { InboxOutputFormat, SuggestionCard } from "./types";

export function formatUpdate(card: SuggestionCard | null, format: InboxOutputFormat): string {
	if (card === null) {
		return "Card not found.";
	}

	if (format === "json") {
		return JSON.stringify(card, null, 2);
	}

	return `Updated: ${card.id}`;
}
