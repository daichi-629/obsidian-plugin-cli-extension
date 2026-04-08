import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SuggestionCard } from "@sample/core";
import { executeDelete, executeUpdate } from "@sample/core";
import { MarkdownRenderer, Menu } from "obsidian";
import type { App, Component } from "obsidian";
import type { InboxStoreManager } from "./InboxStoreManager";
import type { InboxSettings } from "./inboxSettings";

type FeedbackState = { kind: "success" | "error" | "info"; message: string } | null;

const PRIORITY_ORDER: Record<SuggestionCard["priority"], number> = { high: 0, medium: 1, low: 2 };

function actionableCards(cards: SuggestionCard[]): SuggestionCard[] {
	return [...cards]
		.filter((card) => card.status === "open" || card.status === "snoozed")
		.sort((left, right) => {
			const priorityDiff = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
			return priorityDiff !== 0 ? priorityDiff : left.createdAt < right.createdAt ? -1 : 1;
		});
}

function statusLabel(status: SuggestionCard["status"]): string {
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

function formatDateTime(value: string | undefined): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function MarkdownSummary({
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

function PriorityBadge({ priority }: { priority: SuggestionCard["priority"] }) {
	return (
		<span className="inbox-view-priority-badge" data-priority={priority}>
			{priority}
		</span>
	);
}

function StatusBadge({ status }: { status: SuggestionCard["status"] }) {
	return (
		<span className="inbox-view-status-badge" data-status={status}>
			{statusLabel(status)}
		</span>
	);
}

function CardStateSummary({ card }: { card: SuggestionCard }) {
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

export interface InboxFocusViewComponentProps {
	store: InboxStoreManager;
	settings: InboxSettings;
	app: App;
	component: Component;
}

export function InboxFocusViewComponent({
	store,
	app,
	component
}: InboxFocusViewComponentProps) {
	const [cards, setCards] = useState<SuggestionCard[]>([]);
	const [focusIndex, setFocusIndex] = useState(0);
	const [feedback, setFeedback] = useState<FeedbackState>(null);
	const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
	const cardsRef = useRef<SuggestionCard[]>([]);

	useEffect(() => {
		cardsRef.current = cards;
	}, [cards]);

	const reload = useCallback(async () => {
		const loaded = await store.loadCards();
		setCards(loaded);
	}, [store]);

	const wakeupSnoozed = useCallback(async () => {
		const now = new Date();
		const toWake = cardsRef.current.filter(
			(card) => card.status === "snoozed" && card.snoozedUntil && new Date(card.snoozedUntil) <= now
		);
		if (toWake.length === 0) return;

		let updated = cardsRef.current;
		for (const card of toWake) {
			const result = executeUpdate(updated, { id: card.id, status: "open", now });
			updated = result.cards;
		}

		setCards(updated);
		await store.saveCards(updated);
	}, [store]);

	useEffect(() => {
		void reload();
		const id = window.setInterval(() => void wakeupSnoozed(), 60_000);
		return () => window.clearInterval(id);
	}, [reload, wakeupSnoozed]);

	const filtered = useMemo(() => actionableCards(cards), [cards]);
	const card = filtered[Math.min(focusIndex, Math.max(filtered.length - 1, 0))] ?? null;

	useEffect(() => {
		if (focusIndex >= filtered.length && focusIndex > 0) {
			setFocusIndex(filtered.length - 1);
		}
	}, [filtered.length, focusIndex]);

	const persistCards = useCallback(
		async (
			nextCards: SuggestionCard[],
			pendingLabel: string,
			successMessage: string,
			nextIndex?: (nextFiltered: SuggestionCard[]) => number
		) => {
			setPendingActionLabel(pendingLabel);
			setFeedback(null);
			try {
				await store.saveCards(nextCards);
				setCards(nextCards);
				if (nextIndex) {
					const nextFiltered = actionableCards(nextCards);
					setFocusIndex(nextIndex(nextFiltered));
				}
				setFeedback({ kind: "success", message: successMessage });
			} catch (error) {
				setFeedback({
					kind: "error",
					message:
						error instanceof Error
							? `Failed to save inbox changes: ${error.message}`
							: "Failed to save inbox changes."
				});
			} finally {
				setPendingActionLabel(null);
			}
		},
		[store]
	);

	const handleSetStatus = useCallback(
		async (target: SuggestionCard, status: SuggestionCard["status"]) => {
			const result = executeUpdate(cardsRef.current, { id: target.id, status, now: new Date() });
			if (!result.updated) {
				setFeedback({ kind: "error", message: `Card ${target.id} was not found.` });
				return;
			}

			const nextIndex = (nextFiltered: SuggestionCard[]) => {
				if (nextFiltered.length === 0) return 0;
				return Math.min(focusIndex, nextFiltered.length - 1);
			};

			await persistCards(
				result.cards,
				`Saving ${statusLabel(status).toLowerCase()} state...`,
				`${target.title} marked ${statusLabel(status).toLowerCase()}.`,
				nextIndex
			);
		},
		[focusIndex, persistCards]
	);

	const handleSnoozeCard = useCallback(
		async (target: SuggestionCard, until: Date) => {
			const result = executeUpdate(cardsRef.current, {
				id: target.id,
				status: "snoozed",
				snoozedUntil: until.toISOString(),
				now: new Date()
			});
			if (!result.updated) {
				setFeedback({ kind: "error", message: `Card ${target.id} was not found.` });
				return;
			}

			const untilLabel = formatDateTime(until.toISOString()) ?? until.toISOString();
			await persistCards(result.cards, "Saving snooze...", `${target.title} snoozed until ${untilLabel}.`);
		},
		[persistCards]
	);

	const handleSnoozeMenu = useCallback(
		(e: React.MouseEvent, target: SuggestionCard) => {
			const options: Array<{ label: string; getDate: () => Date }> = [
				{ label: "1 hour", getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
				{ label: "3 hours", getDate: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
				{
					label: "Tomorrow",
					getDate: () => {
						const date = new Date();
						date.setDate(date.getDate() + 1);
						date.setHours(9, 0, 0, 0);
						return date;
					}
				},
				{ label: "1 week", getDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
			];
			const menu = new Menu();
			for (const option of options) {
				menu.addItem((item) => {
					item.setTitle(option.label);
					item.onClick(() => void handleSnoozeCard(target, option.getDate()));
				});
			}
			menu.showAtMouseEvent(e.nativeEvent);
		},
		[handleSnoozeCard]
	);

	const handleDeleteCard = useCallback(
		(e: React.MouseEvent, target: SuggestionCard) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(`Delete "${target.title}"`);
				item.onClick(() => {
					void (async () => {
						const result = executeDelete(cardsRef.current, target.id);
						if (!result.deleted) {
							setFeedback({ kind: "error", message: `Card ${target.id} was not found.` });
							return;
						}

						await persistCards(
							result.cards,
							"Deleting card...",
							`${target.title} deleted.`,
							(nextFiltered) => {
								if (nextFiltered.length === 0) return 0;
								return Math.min(focusIndex, nextFiltered.length - 1);
							}
						);
					})();
				});
			});
			menu.showAtMouseEvent(e.nativeEvent);
		},
		[focusIndex, persistCards]
	);

	if (!card) {
		return <div className="inbox-view-empty">No open or snoozed cards to process.</div>;
	}

	return (
		<>
			<div className="inbox-view-nav">
				<button disabled={focusIndex === 0} onClick={() => setFocusIndex(focusIndex - 1)}>
					◀
				</button>
				<span>
					{focusIndex + 1} / {filtered.length}
				</span>
				<button
					disabled={focusIndex === filtered.length - 1}
					onClick={() => setFocusIndex(focusIndex + 1)}
				>
					▶
				</button>
			</div>

			<div className="inbox-view-card-meta">
				<span className="inbox-view-kind-badge">{card.kind}</span>
				<StatusBadge status={card.status} />
				<PriorityBadge priority={card.priority} />
			</div>

			<div className="inbox-view-card-title">{card.title}</div>
			<CardStateSummary card={card} />
			{feedback && (
				<div className="inbox-view-feedback" data-kind={feedback.kind}>
					{feedback.message}
				</div>
			)}
			{pendingActionLabel && <div className="inbox-view-pending">{pendingActionLabel}</div>}

			<MarkdownSummary app={app} content={card.summary} component={component} />

			{card.relatedPaths.length > 0 && (
				<div className="inbox-view-related">
					<span>Related: </span>
					{card.relatedPaths.map((path) => (
						<React.Fragment key={path}>
							<a
								className="inbox-view-related-link"
								onClick={(e) => {
									e.preventDefault();
									void app.workspace.openLinkText(path, "", false);
								}}
							>
								{path}
							</a>{" "}
						</React.Fragment>
					))}
				</div>
			)}

			<div className="inbox-view-actions">
				{card.relatedPaths.length > 0 && (
					<button
						className="inbox-view-open-button"
						disabled={pendingActionLabel !== null}
						onClick={() => void app.workspace.openLinkText(card.relatedPaths[0] ?? "", "", false)}
					>
						Open
					</button>
				)}
				<button disabled={pendingActionLabel !== null} onClick={() => void handleSetStatus(card, "done")}>
					✓ done
				</button>
				<button disabled={pendingActionLabel !== null} onClick={(e) => handleSnoozeMenu(e, card)}>
					{card.status === "snoozed" ? "⏰ resnooze" : "⏰ snooze"}
				</button>
				<button
					disabled={pendingActionLabel !== null}
					onClick={() => void handleSetStatus(card, "dismissed")}
				>
					✗ dismiss
				</button>
				<button
					disabled={pendingActionLabel !== null}
					className="inbox-view-danger-button"
					onClick={(e) => handleDeleteCard(e, card)}
				>
					Delete
				</button>
			</div>
		</>
	);
}
