import React, { useState, useCallback, useEffect, useRef } from "react";
import type { SuggestionCard } from "@sample/core";
import { executeUpdate } from "@sample/core";
import { MarkdownRenderer, Menu } from "obsidian";
import type { App, Component } from "obsidian";
import type { InboxStoreManager } from "./InboxStoreManager";
import type { InboxSettings } from "./inboxSettings";

type FilterStatus = SuggestionCard["status"];

const PRIORITY_ORDER: Record<SuggestionCard["priority"], number> = { high: 0, medium: 1, low: 2 };

function filterAndSort(cards: SuggestionCard[], statuses: FilterStatus[]): SuggestionCard[] {
	return [...cards]
		.filter((c) => statuses.includes(c.status))
		.sort((a, b) => {
			const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
			return diff !== 0 ? diff : a.createdAt < b.createdAt ? -1 : 1;
		});
}

// ── Markdown summary rendered by Obsidian ────────────────────────────────────

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

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: SuggestionCard["priority"] }) {
	return (
		<span className="inbox-view-priority-badge" data-priority={priority}>
			{priority}
		</span>
	);
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({
	mode,
	onFocus,
	onList
}: {
	mode: "focus" | "list";
	onFocus: () => void;
	onList: () => void;
}) {
	return (
		<div className="inbox-view-toolbar">
			<button className={mode === "focus" ? "inbox-view-active-mode" : ""} onClick={onFocus}>
				Focus
			</button>
			<button className={mode === "list" ? "inbox-view-active-mode" : ""} onClick={onList}>
				List
			</button>
		</div>
	);
}

// ── Focus mode ────────────────────────────────────────────────────────────────

interface FocusModeProps {
	filtered: SuggestionCard[];
	focusIndex: number;
	setFocusIndex: (i: number) => void;
	app: App;
	component: Component;
	onSetStatus: (card: SuggestionCard, status: SuggestionCard["status"]) => Promise<void>;
	onSnooze: (e: React.MouseEvent, card: SuggestionCard) => void;
}

function FocusMode({
	filtered,
	focusIndex,
	setFocusIndex,
	app,
	component,
	onSetStatus,
	onSnooze
}: FocusModeProps) {
	if (filtered.length === 0) {
		return <div className="inbox-view-empty">No cards matching the filter.</div>;
	}

	const idx = Math.min(focusIndex, filtered.length - 1);
	const card = filtered[idx];
	if (!card) return null;

	return (
		<>
			<div className="inbox-view-nav">
				<button disabled={idx === 0} onClick={() => setFocusIndex(idx - 1)}>
					◀
				</button>
				<span>
					{idx + 1} / {filtered.length}
				</span>
				<button
					disabled={idx === filtered.length - 1}
					onClick={() => setFocusIndex(idx + 1)}
				>
					▶
				</button>
			</div>

			<div className="inbox-view-card-meta">
				<span className="inbox-view-kind-badge">{card.kind}</span>
				<PriorityBadge priority={card.priority} />
			</div>

			<div className="inbox-view-card-title">{card.title}</div>

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
						onClick={() =>
							void app.workspace.openLinkText(card.relatedPaths[0] ?? "", "", false)
						}
					>
						Open
					</button>
				)}
				<button onClick={() => void onSetStatus(card, "done")}>✓ done</button>
				<button onClick={(e) => onSnooze(e, card)}>⏰ snooze</button>
				<button onClick={() => void onSetStatus(card, "dismissed")}>✗ dismiss</button>
			</div>
		</>
	);
}

// ── List mode ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "open,snoozed", label: "open + snoozed" },
	{ value: "open", label: "open" },
	{ value: "snoozed", label: "snoozed" },
	{ value: "done", label: "done" },
	{ value: "dismissed", label: "dismissed" },
	{ value: "open,snoozed,done,dismissed", label: "all" }
];

interface ListModeProps {
	filtered: SuggestionCard[];
	allCount: number;
	filterStatus: FilterStatus[];
	onFilterChange: (statuses: FilterStatus[]) => void;
	onSelectCard: (index: number) => void;
}

function ListMode({
	filtered,
	allCount,
	filterStatus,
	onFilterChange,
	onSelectCard
}: ListModeProps) {
	const priorityLabel = (p: string) => (p === "high" ? "H" : p === "medium" ? "M" : "L");

	return (
		<>
			<div className="inbox-view-list-controls">
				<span>Status: </span>
				<select
					value={filterStatus.join(",")}
					onChange={(e) => onFilterChange(e.target.value.split(",") as FilterStatus[])}
				>
					{STATUS_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			</div>
			<div className="inbox-view-list">
				{filtered.length === 0 && (
					<div style={{ padding: "8px 12px", color: "var(--text-faint)" }}>No cards.</div>
				)}
				{filtered.map((card, index) => (
					<div
						key={card.id}
						className="inbox-view-list-row"
						onClick={() => onSelectCard(index)}
					>
						<span className="inbox-view-status-dot">
							{card.status === "open" ? "●" : "○"}
						</span>
						<span className="inbox-view-priority-badge" data-priority={card.priority}>
							[{priorityLabel(card.priority)}]
						</span>
						<span className="inbox-view-list-id">{card.id}</span>
						<span className="inbox-view-list-title">{card.title}</span>
					</div>
				))}
			</div>
			<div className="inbox-view-footer">
				{filtered.length} / {allCount} cards
			</div>
		</>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export interface InboxViewComponentProps {
	store: InboxStoreManager;
	settings: InboxSettings;
	app: App;
	component: Component;
}

export function InboxViewComponent({ store, app, component }: InboxViewComponentProps) {
	const [cards, setCards] = useState<SuggestionCard[]>([]);
	const [focusIndex, setFocusIndex] = useState(0);
	const [mode, setMode] = useState<"focus" | "list">("focus");
	const [filterStatus, setFilterStatus] = useState<FilterStatus[]>(["open", "snoozed"]);
	// Ref to always read latest cards in intervals/callbacks (avoids stale closures)
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
			(c) => c.status === "snoozed" && c.snoozedUntil && new Date(c.snoozedUntil) <= now
		);
		if (toWake.length === 0) return;
		let updated = cardsRef.current;
		for (const card of toWake) {
			const { cards: next } = executeUpdate(updated, { id: card.id, status: "open", now });
			updated = next;
		}
		setCards(updated);
		await store.saveCards(updated);
	}, [store]);

	useEffect(() => {
		void reload();
		const id = window.setInterval(() => void wakeupSnoozed(), 60_000);
		return () => window.clearInterval(id);
	}, [reload, wakeupSnoozed]);

	const handleSetStatus = useCallback(
		async (card: SuggestionCard, status: SuggestionCard["status"]) => {
			const { cards: updated, updated: didUpdate } = executeUpdate(cardsRef.current, {
				id: card.id,
				status,
				now: new Date()
			});
			if (!didUpdate) return;
			setCards(updated);
			if (mode === "focus") {
				const newFiltered = filterAndSort(updated, filterStatus);
				setFocusIndex((prev) => (prev >= newFiltered.length && prev > 0 ? prev - 1 : prev));
			}
			await store.saveCards(updated);
		},
		[mode, filterStatus, store]
	);

	const handleSnoozeCard = useCallback(
		async (card: SuggestionCard, until: Date) => {
			const { cards: updated, updated: didUpdate } = executeUpdate(cardsRef.current, {
				id: card.id,
				status: "snoozed",
				snoozedUntil: until.toISOString(),
				now: new Date()
			});
			if (!didUpdate) return;
			setCards(updated);
			await store.saveCards(updated);
		},
		[store]
	);

	const handleSnoozeMenu = useCallback(
		(e: React.MouseEvent, card: SuggestionCard) => {
			const options: Array<{ label: string; getDate: () => Date }> = [
				{ label: "1 hour", getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
				{ label: "3 hours", getDate: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
				{
					label: "Tomorrow",
					getDate: () => {
						const d = new Date();
						d.setDate(d.getDate() + 1);
						d.setHours(9, 0, 0, 0);
						return d;
					}
				},
				{ label: "1 week", getDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
			];
			const menu = new Menu();
			for (const option of options) {
				menu.addItem((item) => {
					item.setTitle(option.label);
					item.onClick(() => void handleSnoozeCard(card, option.getDate()));
				});
			}
			menu.showAtMouseEvent(e.nativeEvent);
		},
		[handleSnoozeCard]
	);

	const handleSelectCard = useCallback((index: number) => {
		setMode("focus");
		setFocusIndex(index);
	}, []);

	const filtered = filterAndSort(cards, filterStatus);

	return (
		<>
			<Toolbar mode={mode} onFocus={() => setMode("focus")} onList={() => setMode("list")} />
			{mode === "focus" ? (
				<FocusMode
					filtered={filtered}
					focusIndex={focusIndex}
					setFocusIndex={setFocusIndex}
					app={app}
					component={component}
					onSetStatus={handleSetStatus}
					onSnooze={handleSnoozeMenu}
				/>
			) : (
				<ListMode
					filtered={filtered}
					allCount={cards.length}
					filterStatus={filterStatus}
					onFilterChange={setFilterStatus}
					onSelectCard={handleSelectCard}
				/>
			)}
		</>
	);
}
