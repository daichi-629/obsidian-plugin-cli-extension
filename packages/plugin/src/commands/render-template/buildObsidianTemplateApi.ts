import { buildTemplateRuntime, type TemplateSystemContext } from "@sample/core";
import type { Plugin } from "obsidian";
import type { TemplateScriptApi } from "./types";

export function buildObsidianTemplateApi(input: {
	plugin: Plugin;
	template: string;
	mode: "single-file" | "bundle";
	destination?: string;
	dryRun: boolean;
	data: Record<string, unknown>;
	system: TemplateSystemContext;
}): TemplateScriptApi {
	const runtime = buildTemplateRuntime({
		data: input.data,
		system: input.system
	});

	return {
		app: input.plugin.app,
		obsidian: (globalThis as { obsidian?: unknown }).obsidian ?? {},
		input: {
			template: input.template,
			mode: input.mode,
			destination: input.destination,
			dryRun: input.dryRun
		},
		data: input.data,
		system: input.system,
		helpers: runtime.helpers,
		path: runtime.path,
		vault: {
			read: async (filePath: string) => {
				const target = input.plugin.app.vault.getAbstractFileByPath(filePath);
				if (!target || !("extension" in target)) {
					throw new Error(`Vault file "${filePath}" could not be resolved.`);
				}

				return input.plugin.app.vault.cachedRead(target);
			},
			exists: async (filePath: string) => Boolean(input.plugin.app.vault.getAbstractFileByPath(filePath)),
			list: async (prefix = "") =>
				input.plugin.app.vault
					.getFiles()
					.map((file) => file.path)
					.filter((filePath) => filePath.startsWith(prefix))
		}
	};
}
