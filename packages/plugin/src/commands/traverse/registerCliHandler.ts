import {
	UserError,
	runTraverseClustersCommand,
	runTraversePathCommand,
	runTraverseReachCommand,
	type TraverseClustersCommandInput,
	type TraversePathCommandInput,
	type TraverseReachCommandInput
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import { collectVaultGraphSnapshot, resolveGraphOperand } from "../../graph";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import {
	parseTraverseClustersCliArgs,
	parseTraversePathCliArgs,
	parseTraverseReachCliArgs
} from "./parseCliArgs";
import {
	traverseClustersCommandSpec,
	traversePathCommandSpec,
	traverseReachCommandSpec
} from "./spec";

function buildReachInput(
	plugin: Plugin,
	params: Parameters<CliHandler>[0]
): TraverseReachCommandInput | string {
	const parsed = parseTraverseReachCliArgs(params);
	if (!parsed.ok) {
		return parsed.message;
	}

	const snapshot = collectVaultGraphSnapshot(plugin);
	return {
		...parsed.value,
		snapshot,
		from: resolveGraphOperand(snapshot, parsed.value.from)
	};
}

function buildPathInput(
	plugin: Plugin,
	params: Parameters<CliHandler>[0]
): TraversePathCommandInput | string {
	const parsed = parseTraversePathCliArgs(params);
	if (!parsed.ok) {
		return parsed.message;
	}

	const snapshot = collectVaultGraphSnapshot(plugin);
	return {
		...parsed.value,
		snapshot,
		from: resolveGraphOperand(snapshot, parsed.value.from),
		to: resolveGraphOperand(snapshot, parsed.value.to)
	};
}

function buildClustersInput(
	plugin: Plugin,
	params: Parameters<CliHandler>[0]
): TraverseClustersCommandInput | string {
	const parsed = parseTraverseClustersCliArgs(params);
	if (!parsed.ok) {
		return parsed.message;
	}

	return {
		...parsed.value,
		snapshot: collectVaultGraphSnapshot(plugin)
	};
}

export function registerTraverseCliHandlers(plugin: Plugin): void {
	const reachHandler: CliHandler = (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(traverseReachCommandSpec);
		}

		try {
			const input = buildReachInput(plugin, params);
			return typeof input === "string" ? input : runTraverseReachCommand(input);
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Traverse reach failed unexpectedly: ${error.message}`
				: "Traverse reach failed unexpectedly.";
		}
	};

	const pathHandler: CliHandler = (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(traversePathCommandSpec);
		}

		try {
			const input = buildPathInput(plugin, params);
			return typeof input === "string" ? input : runTraversePathCommand(input);
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Traverse path failed unexpectedly: ${error.message}`
				: "Traverse path failed unexpectedly.";
		}
	};

	const clustersHandler: CliHandler = (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(traverseClustersCommandSpec);
		}

		try {
			const input = buildClustersInput(plugin, params);
			return typeof input === "string" ? input : runTraverseClustersCommand(input);
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Traverse clusters failed unexpectedly: ${error.message}`
				: "Traverse clusters failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		traverseReachCommandSpec.name,
		traverseReachCommandSpec.summary,
		buildCliFlags(traverseReachCommandSpec),
		reachHandler
	);
	plugin.registerCliHandler(
		traversePathCommandSpec.name,
		traversePathCommandSpec.summary,
		buildCliFlags(traversePathCommandSpec),
		pathHandler
	);
	plugin.registerCliHandler(
		traverseClustersCommandSpec.name,
		traverseClustersCommandSpec.summary,
		buildCliFlags(traverseClustersCommandSpec),
		clustersHandler
	);
}
