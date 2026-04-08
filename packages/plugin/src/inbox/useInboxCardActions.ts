import { useCallback, useEffect, useRef, useState } from "react";
import type { SuggestionCard } from "@sample/core";
import { executeDelete, executeUpdate } from "@sample/core";
import { Menu } from "obsidian";
import type React from "react";
import type { InboxStoreManager } from "./InboxStoreManager";
import {
	actionableCards,
	type FeedbackState,
	formatDateTime,
	statusLabel
} from "./inboxViewShared";

type PersistOptions = {
	nextIndex?: (nextFiltered: SuggestionCard[]) => number;
};

type PersistHandler = (
	nextCards: SuggestionCard[],
	options: PersistOptions | undefined
) => void | Promise<void>;

type DeleteSelectionHandler = (deletedCardId: string) => void;

export function useInboxCardActions({
	store,
	onPersisted,
	onDeleteSelection
}: {
	store: InboxStoreManager;
	onPersisted?: PersistHandler;
	onDeleteSelection?: DeleteSelectionHandler;
}) {
	const [cards, setCards] = useState<SuggestionCard[]>([]);
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

	const persistCards = useCallback(
		async (
			nextCards: SuggestionCard[],
			pendingLabel: string,
			successMessage: string,
			options?: PersistOptions
		) => {
			setPendingActionLabel(pendingLabel);
			setFeedback(null);
			try {
				await store.saveCards(nextCards);
				setCards(nextCards);
				await onPersisted?.(nextCards, options);
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
		[onPersisted, store]
	);

	const handleSetStatus = useCallback(
		async (
			card: SuggestionCard,
			status: SuggestionCard["status"],
			options?: PersistOptions
		) => {
			const result = executeUpdate(cardsRef.current, { id: card.id, status, now: new Date() });
			if (!result.updated) {
				setFeedback({ kind: "error", message: `Card ${card.id} was not found.` });
				return;
			}

			const message =
				card.status === status
					? `${card.title} is already ${statusLabel(status).toLowerCase()}.`
					: `${card.title} marked ${statusLabel(status).toLowerCase()}.`;
			await persistCards(
				result.cards,
				`Saving ${statusLabel(status).toLowerCase()} state...`,
				message,
				options
			);
		},
		[persistCards]
	);

	const handleSnoozeCard = useCallback(
		async (card: SuggestionCard, until: Date, options?: PersistOptions) => {
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
			await persistCards(
				result.cards,
				"Saving snooze...",
				`${card.title} snoozed until ${untilLabel}.`,
				options
			);
		},
		[persistCards]
	);

	const showSnoozeMenu = useCallback(
		(
			event: React.MouseEvent,
			card: SuggestionCard,
			options?: PersistOptions
		) => {
			const snoozeOptions: Array<{ label: string; getDate: () => Date }> = [
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
			for (const option of snoozeOptions) {
				menu.addItem((item) => {
					item.setTitle(option.label);
					item.onClick(() => void handleSnoozeCard(card, option.getDate(), options));
				});
			}
			menu.showAtMouseEvent(event.nativeEvent);
		},
		[handleSnoozeCard]
	);

	const showDeleteMenu = useCallback(
		(
			event: React.MouseEvent,
			card: SuggestionCard,
			options?: PersistOptions
		) => {
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

						onDeleteSelection?.(card.id);
						await persistCards(
							result.cards,
							"Deleting card...",
							`${card.title} deleted.`,
							options
						);
					})();
				});
			});
			menu.showAtMouseEvent(event.nativeEvent);
		},
		[onDeleteSelection, persistCards]
	);

	return {
		cards,
		cardsRef,
		feedback,
		pendingActionLabel,
		persistCards,
		reload,
		setCards,
		setFeedback,
		handleSetStatus,
		handleSnoozeCard,
		showDeleteMenu,
		showSnoozeMenu
	};
}

export function createFocusIndexHandler(focusIndex: number): PersistOptions {
	return {
		nextIndex: (nextFiltered) => {
			if (nextFiltered.length === 0) return 0;
			return Math.min(focusIndex, nextFiltered.length - 1);
		}
	};
}

export function applyPersistedFocusIndex(
	setFocusIndex: (value: number) => void,
	nextCards: SuggestionCard[],
	options?: PersistOptions
) {
	if (!options?.nextIndex) return;
	setFocusIndex(options.nextIndex(actionableCards(nextCards)));
}
