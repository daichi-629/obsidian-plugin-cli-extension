import type { CliData } from "obsidian";
import type { PluginCliParseResult } from "../types";
import type { ApplyPatchCliInput } from "./types";

function readFlag(params: CliData, hyphenated: string, camelCase: string): boolean {
	const value = params[hyphenated] ?? params[camelCase];
	return value === "true";
}

function readValue(params: CliData, hyphenated: string, camelCase: string): string | undefined {
	return params[hyphenated] ?? params[camelCase];
}

export function parseApplyPatchCliArgs(
	params: CliData
): PluginCliParseResult<ApplyPatchCliInput> {
	const patch = readValue(params, "patch", "patch");
	const patchFile = readValue(params, "patch-file", "patchFile");

	if ((patch === undefined && patchFile === undefined) || (patch && patchFile)) {
		return {
			ok: false,
			message: "Specify exactly one of --patch or --patch-file."
		};
	}

	return {
		ok: true,
		value: {
			patch,
			patchFile,
			dryRun: readFlag(params, "dry-run", "dryRun"),
			allowCreate: readFlag(params, "allow-create", "allowCreate"),
			verbose: readFlag(params, "verbose", "verbose")
		}
	};
}
