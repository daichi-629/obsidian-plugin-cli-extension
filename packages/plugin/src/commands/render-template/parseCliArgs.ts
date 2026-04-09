import type { CliData } from "obsidian";
import type { PluginCliParseResult } from "../types";
import type { RenderTemplateCliInput } from "./types";

function getParamValue(params: CliData, hyphenated: string, camelCase: string): unknown {
	const record = params as Record<string, unknown>;
	return record[hyphenated] ?? record[camelCase];
}

function readValue(params: CliData, hyphenated: string, camelCase: string): string | undefined {
	const value = getParamValue(params, hyphenated, camelCase);
	return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceScalar(value: string): unknown {
	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	if (value === "null") {
		return null;
	}

	if (/^-?\d+$/.test(value)) {
		return Number.parseInt(value, 10);
	}

	if (/^-?\d*\.\d+$/.test(value)) {
		return Number.parseFloat(value);
	}

	return value;
}

function assignDottedValue(target: Record<string, unknown>, key: string, value: unknown): void {
	const parts = key.split(".").filter((entry) => entry.length > 0);
	if (parts.length === 0) {
		return;
	}

	let cursor: Record<string, unknown> = target;
	for (const part of parts.slice(0, -1)) {
		const next = cursor[part];
		if (!isRecord(next)) {
			cursor[part] = {};
		}

		cursor = cursor[part] as Record<string, unknown>;
	}

	cursor[parts[parts.length - 1]] = value;
}

function parseJsonObject(value: string, label: string): Record<string, unknown> | string {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) {
			return `The --${label} option must be a JSON object.`;
		}

		return parsed;
	} catch {
		return `The --${label} option must be valid JSON.`;
	}
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

function readFlag(params: CliData, hyphenated: string, camelCase: string): boolean {
	const value = getParamValue(params, hyphenated, camelCase);
	return value === true || value === "true" || value === "";
}

function parseSet(value: string): Record<string, unknown> | string {
	const separatorIndex = value.indexOf("=");
	if (separatorIndex <= 0) {
		return "The --set option must use key=value.";
	}

	const key = value.slice(0, separatorIndex);
	const data: Record<string, unknown> = {};
	assignDottedValue(data, key, coerceScalar(value.slice(separatorIndex + 1)));
	return data;
}

export function parseRenderTemplateCliArgs(
	params: CliData
): PluginCliParseResult<RenderTemplateCliInput> {
	const dataValue = readValue(params, "data", "data");
	const parsedData = dataValue === undefined ? undefined : parseJsonObject(dataValue, "data");
	if (typeof parsedData === "string") {
		return { ok: false, message: parsedData };
	}

	const setEntries: Record<string, unknown>[] = [];
	for (const value of readList(params, "set", "set")) {
		const parsedSet = parseSet(value);
		if (typeof parsedSet === "string") {
			return { ok: false, message: parsedSet };
		}

		setEntries.push(parsedSet);
	}

	const existingFile = readValue(params, "existing-file", "existingFile");
	if (
		existingFile !== undefined &&
		existingFile !== "fail" &&
		existingFile !== "replace" &&
		existingFile !== "skip"
	) {
		return {
			ok: false,
			message: "The --existing-file option must be fail, replace, or skip."
		};
	}

	const duplicateOutput = readValue(params, "duplicate-output", "duplicateOutput");
	if (
		duplicateOutput !== undefined &&
		duplicateOutput !== "fail" &&
		duplicateOutput !== "suffix" &&
		duplicateOutput !== "overwrite"
	) {
		return {
			ok: false,
			message: "The --duplicate-output option must be fail, suffix, or overwrite."
		};
	}

	const write = readValue(params, "write", "write");
	if (write !== undefined && write !== "apply" && write !== "dry-run") {
		return { ok: false, message: "The --write option must be apply or dry-run." };
	}

	const stdout = readValue(params, "stdout", "stdout");
	const outputFormat = readValue(params, "output-format", "outputFormat");
	const includeContent = readFlag(params, "include-content", "includeContent");
	if (
		stdout !== undefined &&
		stdout !== "status/text" &&
		stdout !== "status/json" &&
		stdout !== "content/text" &&
		stdout !== "status+content/text" &&
		stdout !== "status+content/json"
	) {
		return {
			ok: false,
			message:
				"The --stdout option must be status/text, status/json, content/text, status+content/text, or status+content/json."
		};
	}

	if (stdout !== undefined && (outputFormat !== undefined || includeContent)) {
		return {
			ok: false,
			message:
				"Use either --stdout or the --output-format/--include-content aliases, not both."
		};
	}

	if (outputFormat !== undefined && outputFormat !== "text" && outputFormat !== "json") {
		return {
			ok: false,
			message: "The --output-format option must be text or json."
		};
	}

	const derivedStdout =
		stdout ??
		((outputFormat ?? "text") === "json"
			? includeContent
				? "status+content/json"
				: "status/json"
			: includeContent
				? "status+content/text"
				: "status/text");

	return {
		ok: true,
		value: {
			template: readValue(params, "template", "template"),
			destination: readValue(params, "destination", "destination"),
			write,
			stdout: derivedStdout,
			existingFile,
			duplicateOutput,
			dataFile: readList(params, "data-file", "dataFile"),
			data: parsedData,
			set: setEntries
		}
	};
}
