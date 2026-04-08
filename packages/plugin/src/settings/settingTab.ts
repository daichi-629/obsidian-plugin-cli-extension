import { PluginSettingTab, Setting } from "obsidian";
import type SampleMonorepoPlugin from "../main";
import { normalizeConfigDirPathPrefix } from "./grepPolicy";
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
		const configDirPathPrefix =
			normalizeConfigDirPathPrefix(this.app.vault.configDir) ?? "config/";

		new Setting(containerEl).setName("Grep access").setHeading();
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
				`One vault-relative path prefix per line. These prefixes are always denied. ${configDirPathPrefix} is always denied even if omitted here.`
			)
			.addTextArea((textArea) => {
				textArea
					.setValue(
						formatPathPrefixLines(
							this.plugin.settings.grepPermissionSettings.denyPathPrefixes
						)
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
					.setValue(
						formatExtensionLines(
							this.plugin.settings.grepPermissionSettings.targetExtensions
						)
					)
					.onChange(async (value) => {
						this.plugin.settings.grepPermissionSettings.targetExtensions =
							parseExtensionLines(value);
						await this.plugin.saveSettings();
					});

				textArea.inputEl.rows = 4;
				textArea.inputEl.cols = 20;
			});

		new Setting(containerEl).setName("Template command").setHeading();
		containerEl.createEl("p", {
			text: "Configure template lookup, output restrictions, and render limits for the render-template CLI handler."
		});

		new Setting(containerEl)
			.setName("Template root")
			.setDesc("Bare template ids are resolved relative to this vault path prefix.")
			.addText((text) =>
				text
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
				`One vault-relative path prefix per line. Rendered output paths under these prefixes are rejected. ${configDirPathPrefix} is always denied.`
			)
			.addTextArea((textArea) => {
				textArea
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

		new Setting(containerEl).setName("Inbox").setHeading();
		containerEl.createEl("p", {
			text: "Configure inbox card management and deduplication behaviour."
		});

		new Setting(containerEl)
			.setName("Dismiss cooldown (days)")
			.setDesc(
				"Number of days a dismissed card suppresses re-creation from the same fingerprint. 1–30. Default: 7."
			)
			.addText((text) =>
				text
					.setPlaceholder("7")
					.setValue(String(this.plugin.settings.inboxSettings.dismissCooldownDays))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 30) {
							this.plugin.settings.inboxSettings.dismissCooldownDays = parsed;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
