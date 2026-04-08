import type { CliData } from "obsidian";
import type { PluginCliParseResult } from "../types";
import type { SchemaInferCliInput, SchemaMissingCliInput, SchemaValidateCliInput } from "./types";

function getParamValue(params: CliData, hyphenated: string, camelCase: string): unknown {
	const record = params as Record<string, unknown>;
	return record[hyphenated] ?? record[camelCase];
}

function readValue(params: CliData, hyphenated: string, camelCase: string): string | undefined {
	const value = getParamValue(params, hyphenated, camelCase);
	return typeof value === "string" ? value : undefined;
}

function readList(params: CliData, hyphenated: string, camelCase: string): string[] {
	const value = getParamValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return [];
	}

	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === "string");
	}

	return typeof value === "string" ? [value] : [];
}

function parseJsonStringArray(value: string): string[] | null {
	if (!value.trim().startsWith("[")) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
			return [];
		}

		return parsed;
	} catch {
		return [];
	}
}

function readPercentage(
	params: CliData,
	hyphenated: string,
	camelCase: string
): number | undefined | string {
	const value = readValue(params, hyphenated, camelCase);
	if (value === undefined) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
		return `The --${hyphenated} option must be an integer between 0 and 100.`;
	}

	return parsed;
}

function hasAnyValue(params: CliData, keys: string[]): boolean {
	const record = params as Record<string, unknown>;
	return keys.some((key) => record[key] !== undefined);
}

export function parseSchemaInferCliArgs(
	params: CliData
): PluginCliParseResult<SchemaInferCliInput> {
	if (
		hasAnyValue(params, [
			"key",
			"path",
			"missing-threshold",
			"missingThreshold",
			"fail-on",
			"failOn"
		])
	) {
		return {
			ok: false,
			message:
				"The infer command only accepts folder, tag, group-by, min-coverage, and format."
		};
	}

	const minCoverage = readPercentage(params, "min-coverage", "minCoverage");
	if (typeof minCoverage === "string") {
		return { ok: false, message: minCoverage };
	}

	const format = readValue(params, "format", "format") ?? "text";
	if (format !== "text" && format !== "json" && format !== "tsv") {
		return { ok: false, message: "The --format option must be text, json, or tsv." };
	}

	const groupBy = readValue(params, "group-by", "groupBy");
	if (
		groupBy !== undefined &&
		groupBy !== "folder" &&
		groupBy !== "tag" &&
		!groupBy.startsWith("property:")
	) {
		return {
			ok: false,
			message: "The --group-by option must be folder, tag, or property:<key>."
		};
	}

	return {
		ok: true,
		value: {
			folder: readValue(params, "folder", "folder"),
			tag: readValue(params, "tag", "tag"),
			groupBy,
			minCoverage,
			format
		}
	};
}

export function parseSchemaMissingCliArgs(
	params: CliData
): PluginCliParseResult<SchemaMissingCliInput> {
	if (
		hasAnyValue(params, [
			"path",
			"group-by",
			"groupBy",
			"min-coverage",
			"minCoverage",
			"missing-threshold",
			"missingThreshold",
			"fail-on",
			"failOn"
		])
	) {
		return {
			ok: false,
			message: "The missing command only accepts key, folder, tag, and format."
		};
	}

	const key = readValue(params, "key", "key");
	if (!key) {
		return { ok: false, message: "The missing command requires key=<key>." };
	}

	const format = readValue(params, "format", "format") ?? "text";
	if (format !== "text" && format !== "json" && format !== "tsv") {
		return { ok: false, message: "The --format option must be text, json, or tsv." };
	}

	return {
		ok: true,
		value: {
			folder: readValue(params, "folder", "folder"),
			tag: readValue(params, "tag", "tag"),
			key,
			format
		}
	};
}

export function parseSchemaValidateCliArgs(
	params: CliData
): PluginCliParseResult<SchemaValidateCliInput> {
	if (hasAnyValue(params, ["key", "group-by", "groupBy", "min-coverage", "minCoverage"])) {
		return {
			ok: false,
			message:
				"The validate command only accepts path, folder, tag, missing-threshold, fail-on, and format."
		};
	}

	const paths = readList(params, "path", "path");
	const normalizedPaths =
		paths.length === 1 ? (parseJsonStringArray(paths[0] ?? "") ?? paths) : paths;
	if (normalizedPaths.length === 0) {
		return { ok: false, message: "The validate command requires at least one path=<path>." };
	}

	if (
		paths.length === 1 &&
		(paths[0] ?? "").trim().startsWith("[") &&
		normalizedPaths.length === 0
	) {
		return {
			ok: false,
			message: "The path option must be a string path or a JSON array of string paths."
		};
	}

	const missingThreshold = readPercentage(params, "missing-threshold", "missingThreshold");
	if (typeof missingThreshold === "string") {
		return { ok: false, message: missingThreshold };
	}

	const failOn = readValue(params, "fail-on", "failOn");
	if (failOn !== undefined && failOn !== "low" && failOn !== "high" && failOn !== "none") {
		return { ok: false, message: "The --fail-on option must be low, high, or none." };
	}

	const format = readValue(params, "format", "format") ?? "text";
	if (format !== "text" && format !== "json") {
		return { ok: false, message: "The --format option must be text or json." };
	}

	return {
		ok: true,
		value: {
			folder: readValue(params, "folder", "folder"),
			tag: readValue(params, "tag", "tag"),
			paths: normalizedPaths,
			missingThreshold,
			failOn,
			format
		}
	};
}
