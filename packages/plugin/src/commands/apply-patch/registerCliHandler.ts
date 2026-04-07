import {
	UserError,
	formatApplyPatchResult,
	parseApplyPatch,
	planApplyPatchChanges,
	validateApplyPatchInput
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import { applyVaultPatchPlan } from "./applyVaultPatchPlan";
import { buildVaultPatchSource } from "./buildVaultPatchSource";
import { parseApplyPatchCliArgs } from "./parseCliArgs";
import { applyPatchCommandSpec } from "./spec";

export function registerApplyPatchCliHandler(plugin: Plugin): void {
	const handler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(applyPatchCommandSpec);
		}

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
		applyPatchCommandSpec.name,
		applyPatchCommandSpec.summary,
		buildCliFlags(applyPatchCommandSpec),
		handler
	);
}
