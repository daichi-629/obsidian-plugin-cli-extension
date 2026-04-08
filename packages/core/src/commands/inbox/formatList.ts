import type { InboxListResult, InboxOutputFormat } from "./types";

const PRIORITY_LABEL: Record<string, string> = {
	high: "high",
	medium: "medium",
	low: "low"
};

export function formatList(result: InboxListResult, format: InboxOutputFormat): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (result.cards.length === 0) {
		return `0 cards (total: ${result.totalCount})`;
	}

	const lines = result.cards.map((c) => {
		const badge = `[${c.status}/${PRIORITY_LABEL[c.priority] ?? c.priority}]`;
		return `${badge.padEnd(18)}${c.id}  ${c.title}`;
	});

	lines.push(`${result.displayedCount} cards (total: ${result.totalCount})`);
	return lines.join("\n");
}
