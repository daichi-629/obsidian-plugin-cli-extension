import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import {
	INBOX_FOCUS_VIEW_TYPE,
	INBOX_LIST_VIEW_TYPE,
	InboxFocusView,
	InboxListView
} from "./inbox/InboxView";
import { loadPluginSettings, savePluginSettings, type SamplePluginSettings } from "./settings";
import { SamplePluginSettingTab } from "./settings/settingTab";

export default class SampleMonorepoPlugin extends Plugin {
	settings: SamplePluginSettings;

	async onload() {
		this.settings = await loadPluginSettings(this);
		this.addSettingTab(new SamplePluginSettingTab(this));

		const inboxStore = registerCommands(this, this.settings.inboxSettings);

		this.registerView(
			INBOX_FOCUS_VIEW_TYPE,
			(leaf) => new InboxFocusView(leaf, inboxStore, this.settings.inboxSettings)
		);
		this.registerView(
			INBOX_LIST_VIEW_TYPE,
			(leaf) => new InboxListView(leaf, inboxStore, this.settings.inboxSettings)
		);

		const openFocusInboxView = async () => {
			const { workspace } = this.app;
			const leaves = workspace.getLeavesOfType(INBOX_FOCUS_VIEW_TYPE);
			const existing = leaves[0];
			if (existing) {
				await workspace.revealLeaf(existing);
				return;
			}
			const leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf("tab");
			await leaf.setViewState({ type: INBOX_FOCUS_VIEW_TYPE, active: true });
			await workspace.revealLeaf(leaf);
		};

		const openListInboxView = async () => {
			const { workspace } = this.app;
			const leaves = workspace.getLeavesOfType(INBOX_LIST_VIEW_TYPE);
			const existing = leaves[0];
			if (existing) {
				await workspace.revealLeaf(existing);
				return;
			}
			const leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: INBOX_LIST_VIEW_TYPE, active: true });
			await workspace.revealLeaf(leaf);
		};

		this.addRibbonIcon("inbox", "Open inbox focus", () => void openFocusInboxView());
		this.addRibbonIcon("table", "Open inbox list", () => void openListInboxView());

		this.addCommand({
			id: "open-inbox-view",
			name: "Open inbox focus view",
			callback: () => void openFocusInboxView()
		});

		this.addCommand({
			id: "open-inbox-list-view",
			name: "Open inbox list view",
			callback: () => void openListInboxView()
		});
	}

	async saveSettings(): Promise<void> {
		await savePluginSettings(this, this.settings);
	}
}
