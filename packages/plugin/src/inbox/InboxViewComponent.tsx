import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SuggestionCard } from "@sample/core";
import { executeDelete, executeUpdate } from "@sample/core";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type VisibilityState,
	type RowSelectionState,
	type SortingState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable
} from "@tanstack/react-table";
import { MarkdownRenderer, Menu } from "obsidian";
import type { App, Component } from "obsidian";
import type { InboxStoreManager } from "./InboxStoreManager";
import type { InboxSettings } from "./inboxSettings";

type FilterStatus = SuggestionCard["status"];
type FeedbackState = { kind: "success" | "error" | "info"; message: string } | null;

const PRIORITY_ORDER: Record<SuggestionCard["priority"], number> = { high: 0, medium: 1, low: 2 };
const DEFAULT_FILTER_STATUS: FilterStatus[] = ["open", "snoozed", "done", "dismissed"];

function filterAndSort(cards: SuggestionCard[], statuses: FilterStatus[]): SuggestionCard[] {
	return [...cards]
		.filter((card) => statuses.includes(card.status))
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
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}

function cardMatchesQuery(card: SuggestionCard, query: string): boolean {
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

export interface InboxViewComponentProps {
	store: InboxStoreManager;
	settings: InboxSettings;
	app: App;
	component: Component;
}

export function InboxViewComponent({ store, app, component }: InboxViewComponentProps) {
	const [cards, setCards] = useState<SuggestionCard[]>([]);
	const [feedback, setFeedback] = useState<FeedbackState>(null);
	const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
	const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
		{ id: "status", value: DEFAULT_FILTER_STATUS }
	]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ select: false });
	const [selectionMode, setSelectionMode] = useState(false);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
	const [detailWidth, setDetailWidth] = useState(360);
	const cardsRef = useRef<SuggestionCard[]>([]);

	useEffect(() => {
		cardsRef.current = cards;
	}, [cards]);

	useEffect(() => {
		setColumnVisibility((current) => ({ ...current, select: selectionMode }));
	}, [selectionMode]);

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

	const persistCards = useCallback(
		async (nextCards: SuggestionCard[], pendingLabel: string, successMessage: string) => {
			setPendingActionLabel(pendingLabel);
			setFeedback(null);
			try {
				await store.saveCards(nextCards);
				setCards(nextCards);
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
		async (card: SuggestionCard, status: SuggestionCard["status"]) => {
			const result = executeUpdate(cardsRef.current, { id: card.id, status, now: new Date() });
			if (!result.updated) {
				setFeedback({ kind: "error", message: `Card ${card.id} was not found.` });
				return;
			}

			const message =
				card.status === status
					? `${card.title} is already ${statusLabel(status).toLowerCase()}.`
					: `${card.title} marked ${statusLabel(status).toLowerCase()}.`;
			await persistCards(result.cards, `Saving ${statusLabel(status).toLowerCase()} state...`, message);
		},
		[persistCards]
	);

	const handleSnoozeCard = useCallback(
		async (card: SuggestionCard, until: Date) => {
			const result = executeUpdate(cardsRef.current, {
				id: card.id,
				status: "snoozed",
				snoozedUntil: until.toISOString(),
				now: new Date()
			});
			if (!result.updated) {
				setFeedback({ kind: "error", message: `Card ${card.id} was not found.` });
				return;
			}

			const untilLabel = formatDateTime(until.toISOString()) ?? until.toISOString();
			await persistCards(result.cards, "Saving snooze...", `${card.title} snoozed until ${untilLabel}.`);
		},
		[persistCards]
	);

	const handleSnoozeMenu = useCallback(
		(e: React.MouseEvent, card: SuggestionCard) => {
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
					item.onClick(() => void handleSnoozeCard(card, option.getDate()));
				});
			}
			menu.showAtMouseEvent(e.nativeEvent);
		},
		[handleSnoozeCard]
	);

	const handleDeleteCard = useCallback(
		(e: React.MouseEvent, card: SuggestionCard) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(`Delete "${card.title}"`);
				item.onClick(() => {
					void (async () => {
						const result = executeDelete(cardsRef.current, card.id);
						if (!result.deleted) {
							setFeedback({ kind: "error", message: `Card ${card.id} was not found.` });
							return;
						}
						setSelectedCardId((current) => (current === card.id ? null : current));
						await persistCards(result.cards, "Deleting card...", `${card.title} deleted.`);
					})();
				});
			});
			menu.showAtMouseEvent(e.nativeEvent);
		},
		[persistCards]
	);

	const handleBulkSetStatus = useCallback(
		async (ids: string[], status: SuggestionCard["status"]) => {
			let nextCards = cardsRef.current;
			let changedCount = 0;
			const now = new Date();

			for (const id of ids) {
				const existing = nextCards.find((card) => card.id === id);
				if (!existing || existing.status === status) continue;
				const result = executeUpdate(nextCards, { id, status, now });
				if (!result.updated) continue;
				nextCards = result.cards;
				changedCount += 1;
			}

			if (changedCount === 0) {
				setFeedback({ kind: "info", message: "No selected cards needed updating." });
				return;
			}

			setRowSelection({});
			setSelectionMode(false);
			await persistCards(
				nextCards,
				`Updating ${changedCount} cards...`,
				`${changedCount} cards marked ${statusLabel(status).toLowerCase()}.`
			);
		},
		[persistCards]
	);

	const handleBulkDelete = useCallback(
		async (ids: string[]) => {
			let nextCards = cardsRef.current;
			let deletedCount = 0;

			for (const id of ids) {
				const result = executeDelete(nextCards, id);
				if (!result.deleted) continue;
				nextCards = result.cards;
				deletedCount += 1;
			}

			if (deletedCount === 0) {
				setFeedback({ kind: "info", message: "No selected cards could be deleted." });
				return;
			}

			setSelectedCardId((current) => (current && ids.includes(current) ? null : current));
			setRowSelection({});
			setSelectionMode(false);
			await persistCards(nextCards, `Deleting ${deletedCount} cards...`, `${deletedCount} cards deleted.`);
		},
		[persistCards]
	);

	const filteredCards = useMemo(() => filterAndSort(cards, DEFAULT_FILTER_STATUS), [cards]);

	const columns = useMemo<ColumnDef<SuggestionCard>[]>(
		() => [
			{
				id: "select",
				enableSorting: false,
				enableHiding: false,
				header: ({ table }) => (
					selectionMode ? (
						<input
							type="checkbox"
							aria-label="Select all"
							checked={table.getIsAllRowsSelected()}
							ref={(el) => {
								if (el) {
									el.indeterminate =
										table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
								}
							}}
							onChange={table.getToggleAllRowsSelectedHandler()}
						/>
					) : null
				),
				cell: ({ row }) => (
					selectionMode ? (
						<input
							type="checkbox"
							aria-label={`Select ${row.original.title}`}
							checked={row.getIsSelected()}
							onClick={(e) => e.stopPropagation()}
							onChange={row.getToggleSelectedHandler()}
						/>
					) : null
				)
			},
			{
				accessorKey: "status",
				header: "Status",
				filterFn: (row, columnId, filterValue) => {
					const values = Array.isArray(filterValue) ? (filterValue as string[]) : [];
					return values.length === 0 ? true : values.includes(String(row.getValue(columnId)));
				},
				cell: ({ row }) => (
					<span className="inbox-view-list-status-cell">
						<span className="inbox-view-status-dot">
							{row.original.status === "open" ? "●" : "○"}
						</span>
						<span className="inbox-view-list-status">{statusLabel(row.original.status)}</span>
					</span>
				)
			},
			{
				accessorKey: "priority",
				header: "Priority",
				filterFn: (row, columnId, filterValue) => {
					const values = Array.isArray(filterValue) ? (filterValue as string[]) : [];
					return values.length === 0 ? true : values.includes(String(row.getValue(columnId)));
				},
				cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
				sortingFn: (left, right) => PRIORITY_ORDER[left.original.priority] - PRIORITY_ORDER[right.original.priority]
			},
			{
				accessorKey: "kind",
				header: "Kind",
				filterFn: (row, columnId, filterValue) => {
					const values = Array.isArray(filterValue) ? (filterValue as string[]) : [];
					return values.length === 0 ? true : values.includes(String(row.getValue(columnId)));
				},
				cell: ({ row }) => <span className="inbox-view-kind-badge">{row.original.kind}</span>
			},
			{
				accessorKey: "title",
				header: "Title",
				cell: ({ row }) => <span className="inbox-view-list-title">{row.original.title}</span>
			},
			{
				accessorKey: "updatedAt",
				header: "Updated",
				cell: ({ row }) => (
					<span className="inbox-view-list-updated">
						{formatDateTime(row.original.updatedAt) ?? row.original.updatedAt}
					</span>
				)
			}
		],
		[]
	);

	const table = useReactTable({
		data: filteredCards,
		columns,
		state: { sorting, globalFilter, columnFilters, columnVisibility, rowSelection },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		enableRowSelection: true,
		globalFilterFn: (row, _columnId, filterValue) => cardMatchesQuery(row.original, String(filterValue))
	});

	const selectedIds = table.getFilteredSelectedRowModel().rows.map((row) => row.original.id);
	const visibleRows = table.getRowModel().rows;
	const selectedCard = cards.find((card) => card.id === selectedCardId) ?? null;

	const handleColumnMenu = (e: React.MouseEvent) => {
		const menu = new Menu();
		for (const column of table.getAllLeafColumns().filter((current) => current.id !== "select")) {
			menu.addItem((item) => {
				item.setTitle(
					typeof column.columnDef.header === "string" ? column.columnDef.header : column.id
				);
				item.setChecked(column.getIsVisible());
				item.onClick(() => column.toggleVisibility());
			});
		}
		menu.showAtMouseEvent(e.nativeEvent);
	};

	const handleHeaderMenu = (e: React.MouseEvent, columnId: string) => {
		e.stopPropagation();
		const menu = new Menu();
		const column = table.getColumn(columnId);
		if (!column) return;

		if (column.getCanSort()) {
			menu.addItem((item) => {
				item.setTitle("Sort ascending");
				item.onClick(() => column.toggleSorting(false));
			});
			menu.addItem((item) => {
				item.setTitle("Sort descending");
				item.onClick(() => column.toggleSorting(true));
			});
			menu.addItem((item) => {
				item.setTitle("Clear sorting");
				item.onClick(() => setSorting((current) => current.filter((entry) => entry.id !== columnId)));
			});
			menu.addSeparator();
		}

		if (columnId === "status" || columnId === "priority" || columnId === "kind") {
			const options =
				columnId === "status"
					? ["open", "snoozed", "done", "dismissed"]
					: columnId === "priority"
						? ["high", "medium", "low"]
						: ["issue", "question", "idea", "review"];
			const current = Array.isArray(column.getFilterValue()) ? (column.getFilterValue() as string[]) : [];
			for (const option of options) {
				menu.addItem((item) => {
					item.setTitle(columnId === "status" ? statusLabel(option as SuggestionCard["status"]) : option);
					item.setChecked(current.includes(option));
					item.onClick(() => {
						const next = current.includes(option)
							? current.filter((value) => value !== option)
							: [...current, option];
						column.setFilterValue(next.length === 0 ? undefined : next);
					});
				});
			}
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle("Clear filter");
				item.onClick(() => column.setFilterValue(undefined));
			});
		}

		menu.showAtMouseEvent(e.nativeEvent);
	};

	const isColumnFiltered = (columnId: string) => {
		const value = table.getColumn(columnId)?.getFilterValue();
		if (Array.isArray(value)) return value.length > 0;
		return typeof value === "string" ? value.length > 0 : Boolean(value);
	};

	const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		const startX = e.clientX;
		const startWidth = detailWidth;

		const onMouseMove = (event: MouseEvent) => {
			const nextWidth = Math.min(720, Math.max(280, startWidth - (event.clientX - startX)));
			setDetailWidth(nextWidth);
		};

		const onMouseUp = () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	};

	return (
		<div
			className={selectedCard ? "inbox-list-layout has-detail" : "inbox-list-layout"}
			style={
				selectedCard
					? {
							gridTemplateColumns: `minmax(0, 1fr) 8px minmax(280px, ${detailWidth}px)`
						}
					: undefined
			}
		>
			<div className="inbox-list-main">
				<div className="inbox-view-list-controls">
					<input
						className="inbox-view-search"
						type="search"
						placeholder="Filter cards..."
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
					/>
					<button type="button" className="inbox-view-filter-chip" onClick={handleColumnMenu}>
						Columns
					</button>
					<button
						type="button"
						className={selectionMode ? "inbox-view-filter-chip is-active" : "inbox-view-filter-chip"}
						onClick={() => {
							setSelectionMode((current) => {
								const next = !current;
								if (!next) setRowSelection({});
								return next;
							});
						}}
					>
						Select
					</button>
				</div>

				{feedback && (
					<div className="inbox-view-feedback" data-kind={feedback.kind}>
						{feedback.message}
					</div>
				)}
				{pendingActionLabel && <div className="inbox-view-pending">{pendingActionLabel}</div>}

				{selectionMode && (
					<div className="inbox-view-list-bulkbar">
					<span>{selectedIds.length} selected</span>
					<button
						type="button"
						disabled={selectedIds.length === 0 || pendingActionLabel !== null}
						onClick={() => void handleBulkSetStatus(selectedIds, "done")}
					>
						Mark done
					</button>
					<button
						type="button"
						disabled={selectedIds.length === 0 || pendingActionLabel !== null}
						onClick={() => void handleBulkSetStatus(selectedIds, "dismissed")}
					>
						Dismiss
					</button>
					<button
						type="button"
						disabled={selectedIds.length === 0 || pendingActionLabel !== null}
						onClick={() => void handleBulkDelete(selectedIds)}
						className="inbox-view-danger-button"
					>
						Delete
					</button>
					{selectedIds.length > 0 && (
						<button type="button" onClick={() => setRowSelection({})}>
							Clear
						</button>
					)}
					</div>
				)}

				<div className="inbox-view-list">
					{visibleRows.length === 0 && (
						<div style={{ padding: "8px 12px", color: "var(--text-faint)" }}>No cards.</div>
					)}
					{visibleRows.length > 0 && (
						<table className="inbox-view-table">
							<thead>
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => {
											const sortState = header.column.getIsSorted();
											return (
												<th key={header.id}>
													<button
														type="button"
														className="inbox-view-table-sort"
														data-sortable="true"
														onClick={(e) => handleHeaderMenu(e, header.column.id)}
													>
														{header.isPlaceholder
															? null
															: flexRender(
																	header.column.columnDef.header,
																	header.getContext()
																)}
														{sortState === "asc" && " ▲"}
														{sortState === "desc" && " ▼"}
														{isColumnFiltered(header.column.id) && " •"}
													</button>
												</th>
											);
										})}
									</tr>
								))}
							</thead>
							<tbody>
								{visibleRows.map((row) => (
									<tr
										key={row.id}
										className={
											row.original.id === selectedCardId
												? "inbox-view-list-row is-selected"
												: "inbox-view-list-row"
										}
										onClick={() => {
											if (selectionMode) {
												row.toggleSelected();
												return;
											}
											setSelectedCardId(row.original.id);
										}}
									>
										{row.getVisibleCells().map((cell) => (
											<td key={cell.id}>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>

				<div className="inbox-view-footer">
					{visibleRows.length} / {cards.length} cards
				</div>
			</div>

			{selectedCard && (
				<div
					className="inbox-list-resizer"
					role="separator"
					aria-orientation="vertical"
					aria-label="Resize inspect pane"
					onMouseDown={handleResizeStart}
				/>
			)}

			{selectedCard && (
				<div className="inbox-list-detail">
					<>
						<div className="inbox-list-detail-header">
							<button type="button" onClick={() => setSelectedCardId(null)}>
								Back
							</button>
							<span>{selectedCard.title}</span>
						</div>
						<div className="inbox-view-card-meta">
							<span className="inbox-view-kind-badge">{selectedCard.kind}</span>
							<StatusBadge status={selectedCard.status} />
							<PriorityBadge priority={selectedCard.priority} />
						</div>
						<div className="inbox-view-card-title">{selectedCard.title}</div>
						<CardStateSummary card={selectedCard} />
						<MarkdownSummary app={app} content={selectedCard.summary} component={component} />
						{selectedCard.relatedPaths.length > 0 && (
							<div className="inbox-view-related">
								<span>Related: </span>
								{selectedCard.relatedPaths.map((path) => (
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
							{selectedCard.relatedPaths.length > 0 && (
								<button
									className="inbox-view-open-button"
									disabled={pendingActionLabel !== null}
									onClick={() =>
										void app.workspace.openLinkText(
											selectedCard.relatedPaths[0] ?? "",
											"",
											false
										)
									}
								>
									Open
								</button>
							)}
							{selectedCard.status !== "open" && (
								<button
									disabled={pendingActionLabel !== null}
									onClick={() => void handleSetStatus(selectedCard, "open")}
								>
									↺ reopen
								</button>
							)}
							{selectedCard.status !== "done" && (
								<button
									disabled={pendingActionLabel !== null}
									onClick={() => void handleSetStatus(selectedCard, "done")}
								>
									✓ done
								</button>
							)}
							<button
								disabled={pendingActionLabel !== null}
								onClick={(e) => handleSnoozeMenu(e, selectedCard)}
							>
								{selectedCard.status === "snoozed" ? "⏰ resnooze" : "⏰ snooze"}
							</button>
							{selectedCard.status !== "dismissed" && (
								<button
									disabled={pendingActionLabel !== null}
									onClick={() => void handleSetStatus(selectedCard, "dismissed")}
								>
									✗ dismiss
								</button>
							)}
							<button
								disabled={pendingActionLabel !== null}
								className="inbox-view-danger-button"
								onClick={(e) => handleDeleteCard(e, selectedCard)}
							>
								Delete
							</button>
						</div>
					</>
				</div>
			)}
		</div>
	);
}
