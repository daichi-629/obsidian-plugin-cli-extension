import type { SuggestionCard } from "@sample/core";
import type { Plugin } from "obsidian";

type InboxStore = {
	version: 1;
	cards: SuggestionCard[];
};

type StoredData = {
	inboxStore?: unknown;
};

export class InboxStoreManager {
	constructor(private readonly plugin: Plugin) {}

	async loadCards(): Promise<SuggestionCard[]> {
		const data = (await this.plugin.loadData()) as StoredData | null;
		const store = data?.inboxStore;

		if (
			typeof store !== "object" ||
			store === null ||
			(store as Record<string, unknown>)["version"] !== 1
		) {
			return [];
		}

		const cards = (store as InboxStore).cards;
		return Array.isArray(cards) ? cards : [];
	}

	async saveCards(cards: SuggestionCard[]): Promise<void> {
		const existing = ((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
		await this.plugin.saveData({
			...existing,
			inboxStore: { version: 1, cards } satisfies InboxStore
		});
	}
}
