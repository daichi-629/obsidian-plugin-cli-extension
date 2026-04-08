import { PluginSettingTab, Setting } from "obsidian";
import type SampleMonorepoPlugin from "../main";
import {
	formatExtensionLines,
	formatPathPrefixLines,
	parseExtensionLines,
	parsePathPrefixLines
} from "./tabState";

export class SamplePluginSettingTab extends PluginSettingTab {
	plugin: SampleMonorepoPlugin;

	constructor(plugin: SampleMonorepoPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Grep settings" });
		containerEl.createEl("p", {
			text: "Configure which vault paths the grep CLI handler can scan."
		});

		new Setting(containerEl)
			.setName("Enable grep path policy")
			.setDesc(
				"When disabled, allow-path restrictions are ignored, but hard-coded and deny-path restrictions still apply."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.grepPermissionSettings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.grepPermissionSettings.enabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Denied path prefixes")
			.setDesc(
				"One vault-relative path prefix per line. These prefixes are always denied. .obsidian/ is always denied even if omitted here."
			)
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("templates/private/\nsecrets/")
					.setValue(
						formatPathPrefixLines(this.plugin.settings.grepPermissionSettings.denyPathPrefixes)
					)
					.onChange(async (value) => {
						this.plugin.settings.grepPermissionSettings.denyPathPrefixes =
							parsePathPrefixLines(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 6;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Allowed path prefixes")
			.setDesc(
				"One vault-relative path prefix per line. Leave blank to allow the whole vault except denied paths."
			)
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("projects/\nreference/")
					.setValue(
						formatPathPrefixLines(
							this.plugin.settings.grepPermissionSettings.allowPathPrefixes ?? []
						)
					)
					.onChange(async (value) => {
						this.plugin.settings.grepPermissionSettings.allowPathPrefixes =
							parsePathPrefixLines(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 6;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Target file extensions")
			.setDesc(
				"One extension per line without wildcards. Only files with these extensions are scanned."
			)
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder("md\ntxt")
					.setValue(
						formatExtensionLines(this.plugin.settings.grepPermissionSettings.targetExtensions)
					)
					.onChange(async (value) => {
						this.plugin.settings.grepPermissionSettings.targetExtensions =
							parseExtensionLines(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 4;
				textArea.inputEl.cols = 20;
			});

		containerEl.createEl("h2", { text: "Template command settings" });
		containerEl.createEl("p", {
			text: "Configure template lookup, output restrictions, and render limits for the render-template CLI handler."
		});

		new Setting(containerEl)
			.setName("Template root")
			.setDesc("Bare template ids are resolved relative to this vault path prefix.")
			.addText((text) =>
				text
					.setPlaceholder("templates/")
					.setValue(this.plugin.settings.templateCommandSettings.templateRoot)
					.onChange(async (value) => {
						this.plugin.settings.templateCommandSettings.templateRoot =
							parsePathPrefixLines(value)[0] ?? "templates/";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Denied output path prefixes")
			.setDesc(
				"One vault-relative path prefix per line. Rendered output paths under these prefixes are rejected."
			)
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder(".obsidian/\nprivate/")
					.setValue(
						formatPathPrefixLines(
							this.plugin.settings.templateCommandSettings.denyOutputPathPrefixes
						)
					)
					.onChange(async (value) => {
						this.plugin.settings.templateCommandSettings.denyOutputPathPrefixes =
							parsePathPrefixLines(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 4;
				textArea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName("Maximum rendered files")
			.setDesc("Reject bundle renders that would generate more files than this limit.")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(this.plugin.settings.templateCommandSettings.maxRenderedFiles))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isInteger(parsed) && parsed > 0) {
							this.plugin.settings.templateCommandSettings.maxRenderedFiles = parsed;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
