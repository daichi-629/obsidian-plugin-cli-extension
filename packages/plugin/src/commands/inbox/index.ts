import type { Plugin } from "obsidian";
import type { InboxSettings } from "../../inbox/inboxSettings";
import { InboxStoreManager } from "../../inbox/InboxStoreManager";
import { registerInboxCliHandlers } from "./registerCliHandler";

export function registerInboxCommand(plugin: Plugin, settings: InboxSettings): InboxStoreManager {
	const store = new InboxStoreManager(plugin);
	registerInboxCliHandlers(plugin, store, settings);
	return store;
}
