import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SuggestionCard } from "@sample/core";
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
import { executeDelete, executeUpdate } from "@sample/core";
import { Menu } from "obsidian";
import type { App, Component } from "obsidian";
import type { InboxStoreManager } from "./InboxStoreManager";
import type { InboxSettings } from "./inboxSettings";
import {
	cardMatchesQuery,
	CardStateSummary,
	DEFAULT_FILTER_STATUS,
	filterAndSort,
	formatDateTime,
	MarkdownSummary,
	PRIORITY_ORDER,
	PriorityBadge,
	StatusBadge,
	statusLabel
} from "./inboxViewShared";
import { useInboxCardActions } from "./useInboxCardActions";

export interface InboxViewComponentProps {
	store: InboxStoreManager;
	settings: InboxSettings;
	app: App;
	component: Component;
}

export function InboxViewComponent({ store, app, component }: InboxViewComponentProps) {
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
	const {
		cards,
		cardsRef,
		feedback,
		pendingActionLabel,
		persistCards,
		setFeedback,
		handleSetStatus,
		showDeleteMenu,
		showSnoozeMenu
	} = useInboxCardActions({
		store,
		onDeleteSelection: (deletedCardId) => {
			setSelectedCardId((current) => (current === deletedCardId ? null : current));
		}
	});

	useEffect(() => {
		setColumnVisibility((current) => ({ ...current, select: selectionMode }));
	}, [selectionMode]);

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
								onClick={(e) => showSnoozeMenu(e, selectedCard)}
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
								onClick={(e) => showDeleteMenu(e, selectedCard)}
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
