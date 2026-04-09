import type { CliData } from "obsidian";
import type { CliFlagDefinition, CommandSpec } from "./types";

const MANUAL_FLAG_KEY = "man";
const INDENT = "  ";
const OPTION_GAP = 2;

function readFlag(params: CliData, key: string): boolean {
	const value = params[key];
	return value === true || value === "true" || value === "";
}

function formatCommandName(spec: CommandSpec): string {
	return `${spec.name} - ${spec.summary}`;
}

function formatSynopsisLine(line: string): string {
	return `${INDENT}${line}`;
}

function formatWrappedParagraphs(lines: string[]): string[] {
	return lines.map((line) => `${INDENT}${line}`);
}

function formatOptionLabel(key: string, value?: string): string {
	return value === undefined ? key : `${key}=${value}`;
}

function formatOptionDescription(description: string, required?: boolean): string {
	return required ? `${description} Required.` : description;
}

function buildDefaultSynopsis(spec: CommandSpec): string {
	const segments = spec.options.map((option) => {
		const label = formatOptionLabel(option.key, option.value);
		return option.required ? label : `[${label}]`;
	});

	return `obsidian ${spec.name}${segments.length === 0 ? "" : ` ${segments.join(" ")}`}`;
}

function formatOptions(spec: CommandSpec): string[] {
	const labels = spec.options.map((option) => formatOptionLabel(option.key, option.value));
	const width = labels.reduce((max, label) => Math.max(max, label.length), 0);

	return spec.options.map((option, index) => {
		const label = labels[index].padEnd(width + OPTION_GAP, " ");
		return `${INDENT}${label}${formatOptionDescription(option.description, option.required)}`;
	});
}

function formatSection(title: string, lines: string[]): string {
	return [title, ...lines].join("\n");
}

export function buildCliFlags(spec: CommandSpec): Record<string, CliFlagDefinition> {
	const flags: Record<string, CliFlagDefinition> = {};

	for (const option of spec.options) {
		flags[option.key] = {
			value: option.value,
			description: option.description
		};
	}

	flags[MANUAL_FLAG_KEY] = {
		description: "Print the detailed command reference."
	};

	return flags;
}

export function isManualRequest(params: CliData): boolean {
	return readFlag(params, MANUAL_FLAG_KEY);
}

export function buildSynopsis(spec: CommandSpec): string[] {
	const synopsis = spec.synopsis ?? [buildDefaultSynopsis(spec)];
	return [...synopsis, `obsidian ${spec.name} ${MANUAL_FLAG_KEY}`];
}

export function renderCommandReference(spec: CommandSpec): string {
	const sections = [
		formatSection("NAME", [formatSynopsisLine(formatCommandName(spec))]),
		formatSection("SYNOPSIS", buildSynopsis(spec).map(formatSynopsisLine)),
		formatSection("DESCRIPTION", formatWrappedParagraphs(spec.description)),
		formatSection("OPTIONS", formatOptions(spec))
	];

	if (spec.examples && spec.examples.length > 0) {
		sections.push(formatSection("EXAMPLES", spec.examples.map(formatSynopsisLine)));
	}

	if (spec.notes && spec.notes.length > 0) {
		sections.push(formatSection("NOTES", formatWrappedParagraphs(spec.notes)));
	}

	if (spec.seeAlso && spec.seeAlso.length > 0) {
		sections.push(formatSection("SEE ALSO", spec.seeAlso.map(formatSynopsisLine)));
	}

	return sections.join("\n\n");
}
