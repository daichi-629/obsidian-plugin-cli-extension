import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { loadPluginSettings, savePluginSettings, type SamplePluginSettings } from "./settings";
import { SamplePluginSettingTab } from "./settings/settingTab";

export default class SampleMonorepoPlugin extends Plugin {
	settings: SamplePluginSettings;

	async onload() {
		this.settings = await loadPluginSettings(this);
		this.addSettingTab(new SamplePluginSettingTab(this));
		registerCommands(this);
	}

	async saveSettings(): Promise<void> {
		await savePluginSettings(this, this.settings);
	}
}
