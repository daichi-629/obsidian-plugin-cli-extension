import React, { useEffect, useRef } from "react";
import type { SuggestionCard } from "@sample/core";
import { MarkdownRenderer } from "obsidian";
import type { App, Component } from "obsidian";

export type FilterStatus = SuggestionCard["status"];
export type FeedbackState = { kind: "success" | "error" | "info"; message: string } | null;

export const PRIORITY_ORDER: Record<SuggestionCard["priority"], number> = {
	high: 0,
	medium: 1,
	low: 2
};

export const DEFAULT_FILTER_STATUS: FilterStatus[] = ["open", "snoozed", "done", "dismissed"];

export function sortCardsByPriority(cards: SuggestionCard[]): SuggestionCard[] {
	return [...cards].sort((left, right) => {
		const priorityDiff = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
		return priorityDiff !== 0 ? priorityDiff : left.createdAt < right.createdAt ? -1 : 1;
	});
}

export function filterAndSort(cards: SuggestionCard[], statuses: FilterStatus[]): SuggestionCard[] {
	return sortCardsByPriority(cards.filter((card) => statuses.includes(card.status)));
}

export function actionableCards(cards: SuggestionCard[]): SuggestionCard[] {
	return filterAndSort(cards, ["open", "snoozed"]);
}

export function statusLabel(status: SuggestionCard["status"]): string {
	switch (status) {
		case "open":
			return "Open";
		case "snoozed":
			return "Snoozed";
		case "done":
			return "Done";
		case "dismissed":
			return "Dismissed";
	}
}

export function formatDateTime(value: string | undefined): string | null {
	if (!value) return null;

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}

export function cardMatchesQuery(card: SuggestionCard, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;

	return [
		card.title,
		card.summary,
		card.kind,
		card.status,
		card.priority,
		card.relatedPaths.join(" "),
		card.source.command
	]
		.join(" ")
		.toLowerCase()
		.includes(needle);
}

export function MarkdownSummary({
	app,
	content,
	component
}: {
	app: App;
	content: string;
	component: Component;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.empty();
		void MarkdownRenderer.render(app, content, el, "", component);
	}, [app, content, component]);

	return <div ref={ref} className="inbox-view-summary" />;
}

export function PriorityBadge({ priority }: { priority: SuggestionCard["priority"] }) {
	return (
		<span className="inbox-view-priority-badge" data-priority={priority}>
			{priority}
		</span>
	);
}

export function StatusBadge({ status }: { status: SuggestionCard["status"] }) {
	return (
		<span className="inbox-view-status-badge" data-status={status}>
			{statusLabel(status)}
		</span>
	);
}

export function CardStateSummary({ card }: { card: SuggestionCard }) {
	const snoozedUntil = formatDateTime(card.snoozedUntil);
	const dismissedAt = formatDateTime(card.dismissedAt);
	const updatedAt = formatDateTime(card.updatedAt);

	return (
		<div className="inbox-view-card-state">
			<span>
				Status: <strong>{statusLabel(card.status)}</strong>
			</span>
			{snoozedUntil && card.status === "snoozed" && <span>Until: {snoozedUntil}</span>}
			{dismissedAt && card.status === "dismissed" && <span>Dismissed: {dismissedAt}</span>}
			{updatedAt && <span>Updated: {updatedAt}</span>}
		</div>
	);
}
