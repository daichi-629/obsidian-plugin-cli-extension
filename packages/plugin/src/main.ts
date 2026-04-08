import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { INBOX_VIEW_TYPE, InboxView } from "./inbox/InboxView";
import { loadPluginSettings, savePluginSettings, type SamplePluginSettings } from "./settings";
import { SamplePluginSettingTab } from "./settings/settingTab";

export default class SampleMonorepoPlugin extends Plugin {
	settings: SamplePluginSettings;

	async onload() {
		this.settings = await loadPluginSettings(this);
		this.addSettingTab(new SamplePluginSettingTab(this));

		const inboxStore = registerCommands(this, this.settings.inboxSettings);

		this.registerView(
			INBOX_VIEW_TYPE,
			(leaf) => new InboxView(leaf, inboxStore, this.settings.inboxSettings)
		);

		const openInboxView = async () => {
			const { workspace } = this.app;
			// Reveal the leaf if the view is already open somewhere
			const leaves = workspace.getLeavesOfType(INBOX_VIEW_TYPE);
			const existing = leaves[0];
			if (existing) {
				await workspace.revealLeaf(existing);
				return;
			}
			// Otherwise open in the right sidebar, falling back to a new tab
			const leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf("tab");
			await leaf.setViewState({ type: INBOX_VIEW_TYPE, active: true });
			await workspace.revealLeaf(leaf);
		};

		this.addRibbonIcon("inbox", "Open inbox", () => void openInboxView());

		this.addCommand({
			id: "open-inbox-view",
			name: "Open inbox view",
			callback: () => void openInboxView()
		});
	}

	async saveSettings(): Promise<void> {
		await savePluginSettings(this, this.settings);
	}
}
