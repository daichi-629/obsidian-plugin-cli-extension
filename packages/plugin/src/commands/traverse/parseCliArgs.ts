import type { CliData } from "obsidian";
import type { PluginCliParseResult } from "../types";
import type {
	TraverseClustersCliInput,
	TraversePathCliInput,
	TraverseReachCliInput
} from "./types";

function getParamValue(params: CliData, hyphenated: string, camelCase: string): unknown {
	const record = params as Record<string, unknown>;
	return record[hyphenated] ?? record[camelCase];
}

function readValue(params: CliData, hyphenated: string, camelCase: string): string | undefined {
	const value = getParamValue(params, hyphenated, camelCase);
	return typeof value === "string" ? value : undefined;
}

function hasAnyValue(params: CliData, keys: string[]): boolean {
	const record = params as Record<string, unknown>;
	return keys.some((key) => record[key] !== undefined);
}

function readFormat(params: CliData): string {
	return readValue(params, "format", "format") ?? "text";
}

function readNonNegativeIntegerOption(
	params: CliData,
	hyphenated: string,
	camelCase: string
): number | undefined | string {
	const value = readValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return `The --${hyphenated} option must be a non-negative integer.`;
	}

	return parsed;
}

function readPositiveIntegerOption(
	params: CliData,
	hyphenated: string,
	camelCase: string
): number | undefined | string {
	const value = readValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 1) {
		return `The --${hyphenated} option must be a positive integer.`;
	}

	return parsed;
}

export function parseTraverseReachCliArgs(
	params: CliData
): PluginCliParseResult<TraverseReachCliInput> {
	if (hasAnyValue(params, ["to", "min-size", "minSize"])) {
		return {
			ok: false,
			message: "The reach command only accepts from, depth, direction, folder, tag, and format."
		};
	}

	const from = readValue(params, "from", "from");
	if (!from) {
		return { ok: false, message: "The reach command requires from=<path-or-linkpath>." };
	}

	const depth = readNonNegativeIntegerOption(params, "depth", "depth");
	if (typeof depth === "string") {
		return { ok: false, message: depth };
	}

	const direction = readValue(params, "direction", "direction") ?? "out";
	if (direction !== "out" && direction !== "in" && direction !== "both") {
		return { ok: false, message: "The --direction option must be out, in, or both." };
	}

	const format = readFormat(params);
	if (format !== "text" && format !== "json" && format !== "tsv") {
		return { ok: false, message: "The --format option must be text, json, or tsv." };
	}

	return {
		ok: true,
		value: {
			from,
			depth,
			direction,
			folder: readValue(params, "folder", "folder"),
			tag: readValue(params, "tag", "tag"),
			format
		}
	};
}

export function parseTraversePathCliArgs(
	params: CliData
): PluginCliParseResult<TraversePathCliInput> {
	if (hasAnyValue(params, ["depth", "min-size", "minSize"])) {
		return {
			ok: false,
			message: "The path command only accepts from, to, direction, folder, tag, and format."
		};
	}

	const from = readValue(params, "from", "from");
	if (!from) {
		return { ok: false, message: "The path command requires from=<path-or-linkpath>." };
	}

	const to = readValue(params, "to", "to");
	if (!to) {
		return { ok: false, message: "The path command requires to=<path-or-linkpath>." };
	}

	const direction = readValue(params, "direction", "direction") ?? "out";
	if (direction !== "out" && direction !== "both") {
		return { ok: false, message: "The --direction option must be out or both." };
	}

	const format = readFormat(params);
	if (format !== "text" && format !== "json" && format !== "tsv") {
		return { ok: false, message: "The --format option must be text, json, or tsv." };
	}

	return {
		ok: true,
		value: {
			from,
			to,
			direction,
			folder: readValue(params, "folder", "folder"),
			tag: readValue(params, "tag", "tag"),
			format
		}
	};
}

export function parseTraverseClustersCliArgs(
	params: CliData
): PluginCliParseResult<TraverseClustersCliInput> {
	if (hasAnyValue(params, ["from", "to", "depth", "direction"])) {
		return {
			ok: false,
			message: "The clusters command only accepts folder, tag, min-size, and format."
		};
	}

	const minSize = readPositiveIntegerOption(params, "min-size", "minSize");
	if (typeof minSize === "string") {
		return { ok: false, message: minSize };
	}

	const format = readFormat(params);
	if (format !== "text" && format !== "json" && format !== "tsv") {
		return { ok: false, message: "The --format option must be text, json, or tsv." };
	}

	return {
		ok: true,
		value: {
			folder: readValue(params, "folder", "folder"),
			tag: readValue(params, "tag", "tag"),
			minSize,
			format
		}
	};
}
