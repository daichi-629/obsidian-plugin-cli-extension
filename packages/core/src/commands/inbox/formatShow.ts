import type { InboxOutputFormat, SuggestionCard } from "./types";

export function formatShow(card: SuggestionCard | null, format: InboxOutputFormat): string {
	if (format === "json") {
		return JSON.stringify(card, null, 2);
	}

	if (card === null) {
		return "Card not found.";
	}

	const lines: string[] = [
		`ID:        ${card.id}`,
		`Kind:      ${card.kind}`,
		`Status:    ${card.status}`,
		`Priority:  ${card.priority}`,
		`Title:     ${card.title}`
	];

	if (card.summary) {
		lines.push(`Summary:   ${card.summary}`);
	}

	lines.push(`Source:    ${card.source.command} (${card.source.runAt})`);

	if (card.relatedPaths.length > 0) {
		lines.push(`Related:   ${card.relatedPaths.join(", ")}`);
	}

	if (card.evidence && card.evidence.length > 0) {
		lines.push(`Evidence:  ${card.evidence.length} item(s)`);
	}

	if (card.suggestedActions && card.suggestedActions.length > 0) {
		lines.push(`Actions:   ${card.suggestedActions.length} item(s)`);
	}

	lines.push(`Seen:      ${card.seenCount}`);
	lines.push(`Created:   ${card.createdAt}`);

	if (card.snoozedUntil) {
		lines.push(`Snoozed:   ${card.snoozedUntil}`);
	}

	return lines.join("\n");
}
