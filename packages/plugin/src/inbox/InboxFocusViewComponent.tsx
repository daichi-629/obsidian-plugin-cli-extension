import React, { useEffect, useMemo, useState } from "react";
import type { App, Component } from "obsidian";
import type { InboxStoreManager } from "./InboxStoreManager";
import type { InboxSettings } from "./inboxSettings";
import {
	actionableCards,
	CardStateSummary,
	MarkdownSummary,
	PriorityBadge,
	StatusBadge
} from "./inboxViewShared";
import {
	applyPersistedFocusIndex,
	createFocusIndexHandler,
	useInboxCardActions
} from "./useInboxCardActions";

export interface InboxFocusViewComponentProps {
	store: InboxStoreManager;
	settings: InboxSettings;
	app: App;
	component: Component;
}

export function InboxFocusViewComponent({ store, app, component }: InboxFocusViewComponentProps) {
	const [focusIndex, setFocusIndex] = useState(0);
	const { cards, feedback, pendingActionLabel, handleSetStatus, showDeleteMenu, showSnoozeMenu } =
		useInboxCardActions({
			store,
			onPersisted: async (nextCards, options) => {
				applyPersistedFocusIndex(setFocusIndex, nextCards, options);
			}
		});

	const filtered = useMemo(() => actionableCards(cards), [cards]);
	const card = filtered[Math.min(focusIndex, Math.max(filtered.length - 1, 0))] ?? null;

	useEffect(() => {
		if (focusIndex >= filtered.length && focusIndex > 0) {
			setFocusIndex(filtered.length - 1);
		}
	}, [filtered.length, focusIndex]);

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
						onClick={() =>
							void app.workspace.openLinkText(card.relatedPaths[0] ?? "", "", false)
						}
					>
						Open
					</button>
				)}
				<button
					disabled={pendingActionLabel !== null}
					onClick={() => void handleSetStatus(card, "done")}
				>
					✓ done
				</button>
				<button
					disabled={pendingActionLabel !== null}
					onClick={(e) => showSnoozeMenu(e, card, createFocusIndexHandler(focusIndex))}
				>
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
					onClick={(e) => showDeleteMenu(e, card, createFocusIndexHandler(focusIndex))}
				>
					Delete
				</button>
			</div>
		</>
	);
}
