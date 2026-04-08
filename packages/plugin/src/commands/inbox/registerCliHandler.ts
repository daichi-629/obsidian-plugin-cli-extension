import {
	executeCreate,
	executeDelete,
	executeList,
	executeShow,
	executeUpdate,
	formatCreate,
	formatList,
	formatShow,
	formatUpdate
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import type { InboxSettings } from "../../inbox/inboxSettings";
import type { InboxStoreManager } from "../../inbox/InboxStoreManager";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import {
	parseInboxCreateCliArgs,
	parseInboxDeleteCliArgs,
	parseInboxListCliArgs,
	parseInboxShowCliArgs,
	parseInboxUpdateCliArgs
} from "./parseCliArgs";
import {
	inboxCreateCommandSpec,
	inboxDeleteCommandSpec,
	inboxListCommandSpec,
	inboxShowCommandSpec,
	inboxUpdateCommandSpec
} from "./spec";

export function registerInboxCliHandlers(
	plugin: Plugin,
	store: InboxStoreManager,
	settings: InboxSettings
): void {
	const createHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(inboxCreateCommandSpec);
		}

		const parsed = parseInboxCreateCliArgs(params);
		if (!parsed.ok) return parsed.message;

		for (const path of parsed.value.relatedPaths) {
			if (!plugin.app.vault.getFileByPath(path)) {
				return `File not found in vault: ${path}`;
			}
		}

		try {
			const cards = await store.loadCards();
			const { cards: updated, result } = executeCreate(cards, {
				...parsed.value,
				now: new Date(),
				dismissCooldownDays: settings.dismissCooldownDays
			});
			await store.saveCards(updated);
			return formatCreate(result, parsed.value.format);
		} catch (error) {
			return error instanceof Error
				? `Inbox create failed: ${error.message}`
				: "Inbox create failed unexpectedly.";
		}
	};

	const listHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(inboxListCommandSpec);
		}

		const parsed = parseInboxListCliArgs(params);
		if (!parsed.ok) return parsed.message;

		try {
			const cards = await store.loadCards();
			const result = executeList(cards, parsed.value);
			return formatList(result, parsed.value.format);
		} catch (error) {
			return error instanceof Error
				? `Inbox list failed: ${error.message}`
				: "Inbox list failed unexpectedly.";
		}
	};

	const showHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(inboxShowCommandSpec);
		}

		const parsed = parseInboxShowCliArgs(params);
		if (!parsed.ok) return parsed.message;

		try {
			const cards = await store.loadCards();
			const card = executeShow(cards, parsed.value.id);
			if (card === null) {
				return `Card not found: ${parsed.value.id}`;
			}
			return formatShow(card, parsed.value.format);
		} catch (error) {
			return error instanceof Error
				? `Inbox show failed: ${error.message}`
				: "Inbox show failed unexpectedly.";
		}
	};

	const updateHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(inboxUpdateCommandSpec);
		}

		const parsed = parseInboxUpdateCliArgs(params);
		if (!parsed.ok) return parsed.message;

		try {
			const cards = await store.loadCards();
			const { cards: updated, updated: card } = executeUpdate(cards, {
				...parsed.value,
				now: new Date()
			});
			if (card === null) {
				return `Card not found: ${parsed.value.id}`;
			}
			await store.saveCards(updated);
			return formatUpdate(card, parsed.value.format);
		} catch (error) {
			return error instanceof Error
				? `Inbox update failed: ${error.message}`
				: "Inbox update failed unexpectedly.";
		}
	};

	const deleteHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(inboxDeleteCommandSpec);
		}

		const parsed = parseInboxDeleteCliArgs(params);
		if (!parsed.ok) return parsed.message;

		try {
			const cards = await store.loadCards();
			const { cards: updated, deleted } = executeDelete(cards, parsed.value.id);
			if (!deleted) {
				return `Card not found: ${parsed.value.id}`;
			}
			await store.saveCards(updated);
			return "";
		} catch (error) {
			return error instanceof Error
				? `Inbox delete failed: ${error.message}`
				: "Inbox delete failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		inboxCreateCommandSpec.name,
		inboxCreateCommandSpec.summary,
		buildCliFlags(inboxCreateCommandSpec),
		createHandler
	);
	plugin.registerCliHandler(
		inboxListCommandSpec.name,
		inboxListCommandSpec.summary,
		buildCliFlags(inboxListCommandSpec),
		listHandler
	);
	plugin.registerCliHandler(
		inboxShowCommandSpec.name,
		inboxShowCommandSpec.summary,
		buildCliFlags(inboxShowCommandSpec),
		showHandler
	);
	plugin.registerCliHandler(
		inboxUpdateCommandSpec.name,
		inboxUpdateCommandSpec.summary,
		buildCliFlags(inboxUpdateCommandSpec),
		updateHandler
	);
	plugin.registerCliHandler(
		inboxDeleteCommandSpec.name,
		inboxDeleteCommandSpec.summary,
		buildCliFlags(inboxDeleteCommandSpec),
		deleteHandler
	);
}
