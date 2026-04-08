import type { CommandSpec } from "../../shared/cli/types";

export const schemaInferCommandSpec: CommandSpec = {
	name: "excli-schema:infer",
	summary: "Infer deterministic frontmatter/property schema summaries from the vault.",
	synopsis: [
		"obsidian excli-schema:infer [folder=<path>] [tag=<tag>] [group-by=<folder|tag|property:<key>>] [min-coverage=<0-100>] [format=<text|json|tsv>]"
	],
	description: [
		"Scan markdown note frontmatter and property metadata, then summarize the schema for the selected vault scope.",
		"Use group-by to compare schema differences by folder, tag, or a scalar property value."
	],
	options: [
		{
			key: "folder",
			value: "<path>",
			description: "Limit the schema scope to a vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit the schema scope to notes with the given tag."
		},
		{
			key: "group-by",
			value: "<folder|tag|property:<key>>",
			description: "Split the base scope into grouped schema summaries."
		},
		{
			key: "min-coverage",
			value: "<0-100>",
			description: "Only include properties at or above this coverage percentage."
		},
		{
			key: "format",
			value: "<text|json|tsv>",
			description: "Render text, JSON, or TSV output."
		}
	]
};

export const schemaMissingCommandSpec: CommandSpec = {
	name: "excli-schema:missing",
	summary: "List notes that are missing a given frontmatter property.",
	synopsis: [
		"obsidian excli-schema:missing key=<key> [folder=<path>] [tag=<tag>] [format=<text|json|tsv>]"
	],
	description: [
		"Find notes in the selected scope that do not define the requested property key."
	],
	options: [
		{ key: "key", value: "<key>", description: "Property key to check for.", required: true },
		{
			key: "folder",
			value: "<path>",
			description: "Limit the search scope to a vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit the search scope to notes with the given tag."
		},
		{
			key: "format",
			value: "<text|json|tsv>",
			description: "Render text, JSON, or path-only TSV output."
		}
	]
};

export const schemaValidateCommandSpec: CommandSpec = {
	name: "excli-schema:validate",
	summary: "Validate one or more notes against the schema inferred from another scope.",
	synopsis: [
		"obsidian excli-schema:validate path=<path> [path=<path> ...] [folder=<path>] [tag=<tag>] [missing-threshold=<0-100>] [fail-on=<low|high|none>] [format=<text|json>]"
	],
	description: [
		"Compare one or more target notes with the inferred schema from the selected scope.",
		"Target notes are excluded from the schema scope before validation."
	],
	options: [
		{
			key: "path",
			value: "<path>",
			description: "Vault-relative markdown note to validate. Repeatable.",
			required: true
		},
		{
			key: "folder",
			value: "<path>",
			description: "Limit the schema scope to a vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit the schema scope to notes with the given tag."
		},
		{
			key: "missing-threshold",
			value: "<0-100>",
			description: "Coverage threshold for missing-property issues."
		},
		{
			key: "fail-on",
			value: "<low|high|none>",
			description: "Severity threshold that marks the batch as failed."
		},
		{ key: "format", value: "<text|json>", description: "Render text or JSON output." }
	],
	notes: [
		"Repeat path=<path> when the CLI adapter preserves repeated flags.",
		'If your CLI adapter collapses repeated path flags, pass a JSON array instead, for example: path=\'["HOME.md","reference/frontmatter-lab.md"]\'.'
	]
};
