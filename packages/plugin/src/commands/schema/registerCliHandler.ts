import {
	UserError,
	runSchemaInferCommand,
	runSchemaMissingCommand,
	runSchemaValidateCommand,
	type SchemaGroupBy
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import { buildVaultSchemaSnapshot } from "../../analysis/buildVaultSchemaSnapshot";
import {
	filterVaultSchemaSnapshot,
	resolveSchemaTargetNotes
} from "../../analysis/filterVaultSchemaSnapshot";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import {
	parseSchemaInferCliArgs,
	parseSchemaMissingCliArgs,
	parseSchemaValidateCliArgs
} from "./parseCliArgs";
import {
	schemaInferCommandSpec,
	schemaMissingCommandSpec,
	schemaValidateCommandSpec
} from "./spec";

function parseGroupBy(value: string | undefined): SchemaGroupBy | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (value === "folder") {
		return { kind: "folder" };
	}

	if (value === "tag") {
		return { kind: "tag" };
	}

	if (value.startsWith("property:")) {
		const key = value.slice("property:".length);
		if (key.length === 0) {
			throw new UserError("The --group-by option must be folder, tag, or property:<key>.");
		}

		return { kind: "property", key };
	}

	throw new UserError("The --group-by option must be folder, tag, or property:<key>.");
}

export function registerSchemaCliHandlers(plugin: Plugin): void {
	const inferHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(schemaInferCommandSpec);
		}

		const parsed = parseSchemaInferCliArgs(params);
		if (!parsed.ok) {
			return parsed.message;
		}

		try {
			const scoped = filterVaultSchemaSnapshot(await buildVaultSchemaSnapshot(plugin), parsed.value);
			return runSchemaInferCommand({
				snapshot: scoped.snapshot,
				scope: scoped.scope,
				groupBy: parseGroupBy(parsed.value.groupBy),
				minCoverage: parsed.value.minCoverage,
				format: parsed.value.format
			});
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Schema inference failed unexpectedly: ${error.message}`
				: "Schema inference failed unexpectedly.";
		}
	};

	const missingHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(schemaMissingCommandSpec);
		}

		const parsed = parseSchemaMissingCliArgs(params);
		if (!parsed.ok) {
			return parsed.message;
		}

		try {
			const scoped = filterVaultSchemaSnapshot(await buildVaultSchemaSnapshot(plugin), parsed.value);
			return runSchemaMissingCommand({
				snapshot: scoped.snapshot,
				scope: scoped.scope,
				key: parsed.value.key,
				format: parsed.value.format
			});
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Schema missing check failed unexpectedly: ${error.message}`
				: "Schema missing check failed unexpectedly.";
		}
	};

	const validateHandler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(schemaValidateCommandSpec);
		}

		const parsed = parseSchemaValidateCliArgs(params);
		if (!parsed.ok) {
			return parsed.message;
		}

		try {
			const snapshot = await buildVaultSchemaSnapshot(plugin);
			const targets = resolveSchemaTargetNotes(snapshot, parsed.value.paths);
			const targetPaths = new Set(targets.map((target) => target.path));
			const scoped = filterVaultSchemaSnapshot(snapshot, parsed.value);
			const schemaScopeNotes = scoped.snapshot.notes.filter((note) => !targetPaths.has(note.path));
			return runSchemaValidateCommand({
				snapshot: {
					propertyCatalog: scoped.snapshot.propertyCatalog,
					notes: schemaScopeNotes
				},
				scope: {
					...scoped.scope,
					noteCount: schemaScopeNotes.length
				},
				targets,
				missingThreshold: parsed.value.missingThreshold,
				failOn: parsed.value.failOn,
				format: parsed.value.format
			});
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Schema validation failed unexpectedly: ${error.message}`
				: "Schema validation failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		schemaInferCommandSpec.name,
		schemaInferCommandSpec.summary,
		buildCliFlags(schemaInferCommandSpec),
		inferHandler
	);
	plugin.registerCliHandler(
		schemaMissingCommandSpec.name,
		schemaMissingCommandSpec.summary,
		buildCliFlags(schemaMissingCommandSpec),
		missingHandler
	);
	plugin.registerCliHandler(
		schemaValidateCommandSpec.name,
		schemaValidateCommandSpec.summary,
		buildCliFlags(schemaValidateCommandSpec),
		validateHandler
	);
}
