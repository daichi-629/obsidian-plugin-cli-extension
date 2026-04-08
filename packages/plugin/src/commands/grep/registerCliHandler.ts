import { formatSearchResult, parseSearchOptions, searchDocuments } from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import { getGrepPathPolicyErrorForMany, type SamplePluginSettings } from "../../settings";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import { buildVaultSource } from "./buildVaultSource";
import { parseGrepCliArgs } from "./parseCliArgs";
import { grepCommandSpec } from "./spec";

function formatSkippedWarning(skippedFiles: number): string {
	return skippedFiles === 1
		? "(1 file skipped due to read error)"
		: `(${skippedFiles} files skipped due to read error)`;
}

type GrepPlugin = Plugin & { settings: SamplePluginSettings };

export function registerGrepCliHandler(plugin: GrepPlugin): void {
	const handler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(grepCommandSpec);
		}

		const parsedArgs = parseGrepCliArgs(params);
		if (!parsedArgs.ok) {
			return parsedArgs.message;
		}

		const pathPolicyError = getGrepPathPolicyErrorForMany(
			parsedArgs.value.pathPrefixes ?? [],
			plugin.settings.grepPermissionSettings,
			plugin.app.vault.configDir
		);
		if (pathPolicyError) {
			return pathPolicyError;
		}

		let options;
		try {
			options = parseSearchOptions(parsedArgs.value);
		} catch (error) {
			return error instanceof Error ? error.message : "Failed to parse grep options.";
		}

		try {
			const source = buildVaultSource(plugin, parsedArgs.value);
			const result = await searchDocuments(source.documents, options);
			result.skippedFiles = source.getSkippedCount();

			const output = formatSearchResult(result, options);
			if (result.skippedFiles === 0 || options.json) {
				return output;
			}

			return `${output}\n${formatSkippedWarning(result.skippedFiles)}`;
		} catch (error) {
			return error instanceof Error ? error.message : "Vault grep failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		grepCommandSpec.name,
		grepCommandSpec.summary,
		buildCliFlags(grepCommandSpec),
		handler
	);
}
