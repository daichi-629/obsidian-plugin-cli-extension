import {
	UserError,
	formatApplyPatchResult,
	parseApplyPatch,
	planApplyPatchChanges,
	validateApplyPatchInput
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import { applyVaultPatchPlan } from "./applyVaultPatchPlan";
import { buildVaultPatchSource } from "./buildVaultPatchSource";
import { parseApplyPatchCliArgs } from "./parseCliArgs";

const CLI_FLAGS = {
	patch: {
		value: "<patch>",
		description: "Patch text in Codex apply_patch format."
	},
	"patch-file": {
		value: "<path>",
		description: "Read patch text from a filesystem path or vault:path."
	},
	"dry-run": {
		description: "Validate and preview changes without writing files."
	},
	"allow-create": {
		description: "Allow Add File operations."
	},
	verbose: {
		description: "Include detailed per-file output."
	}
};

export function registerApplyPatchCliHandler(plugin: Plugin): void {
	const handler: CliHandler = async (params) => {
		const parsedArgs = parseApplyPatchCliArgs(params);
		if (!parsedArgs.ok) {
			return parsedArgs.message;
		}

		try {
			const patchText = await buildVaultPatchSource(plugin, parsedArgs.value);
			const input = validateApplyPatchInput({
				patchText,
				dryRun: parsedArgs.value.dryRun,
				verbose: parsedArgs.value.verbose,
				allowCreate: parsedArgs.value.allowCreate
			});
			const parsedPatch = parseApplyPatch(input.patchText);
			const plan = planApplyPatchChanges(parsedPatch, input);
			const result = await applyVaultPatchPlan(plugin, plan, {
				dryRun: input.dryRun
			});
			return formatApplyPatchResult(result, {
				dryRun: input.dryRun,
				verbose: input.verbose
			});
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Apply patch failed unexpectedly: ${error.message}`
				: "Apply patch failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		"sample-monorepo-plugin-apply-patch",
		"Apply a Codex-compatible patch to vault files.",
		CLI_FLAGS,
		handler
	);
}
