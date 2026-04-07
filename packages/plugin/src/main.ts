import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { loadPluginSettings, type SamplePluginSettings } from "./settings";

export default class SampleMonorepoPlugin extends Plugin {
	settings: SamplePluginSettings;

	async onload() {
		this.settings = await loadPluginSettings(this);
		registerCommands(this);
	}
}
