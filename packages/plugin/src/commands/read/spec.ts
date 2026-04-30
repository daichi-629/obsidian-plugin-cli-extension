import type { CommandSpec } from "../../shared/cli/types";

export const readBulkCommandSpec: CommandSpec = {
	name: "excli-read:bulk",
	summary: "Read multiple markdown notes in one deterministic bundle.",
	synopsis: [
		"obsidian excli-read:bulk path=<path> [max-files=<n>] [max-char=<n>] [include-frontmatter] [resolve-embeds] [embed-depth=<n>] [annotate-embeds] [format=<markdown|json|tsv>]",
		"obsidian excli-read:bulk paths=<path[,path...]|json-array> [max-files=<n>] [max-char=<n>] [include-frontmatter] [resolve-embeds] [embed-depth=<n>] [annotate-embeds] [format=<markdown|json|tsv>]",
		"obsidian excli-read:bulk [folder=<path>] [tag=<tag>] [sort=<path|mtime|size>] [max-files=<n>] [max-char=<n>] [include-frontmatter] [resolve-embeds] [embed-depth=<n>] [annotate-embeds] [format=<markdown|json|tsv>]"
	],
	description: [
		"Fetch multiple markdown notes in one round trip, optionally flattening embeds before formatting.",
		"Explicit path selection preserves caller order after deduplication. folder and tag selection filter the vault note catalog and then sort deterministically."
	],
	options: [
		{
			key: "path",
			value: "<path>",
			description: "Single vault-relative markdown path."
		},
		{
			key: "paths",
			value: "<path[,path...]|json-array>",
			description: "Explicit note list as a comma-separated string or JSON array."
		},
		{
			key: "folder",
			value: "<path>",
			description: "Limit selection to notes under the given vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit selection to notes that include the given tag."
		},
		{
			key: "sort",
			value: "<path|mtime|size>",
			description: "Scoped selection sort order."
		},
		{
			key: "max-files",
			value: "<n>",
			description: "Limit the number of selected notes before formatting."
		},
		{
			key: "max-char",
			value: "<n>",
			description: "Maximum returned character budget before deterministic truncation."
		},
		{
			key: "include-frontmatter",
			description: "Include YAML-style frontmatter blocks in markdown and JSON bundles."
		},
		{
			key: "resolve-embeds",
			description: "Recursively expand ![[...]] embeds before budgeting and formatting."
		},
		{
			key: "embed-depth",
			value: "<n>",
			description: "Maximum recursive embed expansion depth as a non-negative integer."
		},
		{
			key: "annotate-embeds",
			description: "Insert source comments before resolved embed content."
		},
		{
			key: "format",
			value: "<markdown|json|tsv>",
			description: "Render markdown, JSON, or TSV output."
		}
	],
	notes: [
		"path/paths and folder/tag selection are mutually exclusive.",
		"Use `paths=` for multiple explicit notes in the Obsidian CLI.",
		'If you need shell-safe explicit lists, pass a JSON array instead, for example: paths=\'["HOME.md","notes/roadmap.md"]\'.',
		"Quote path, folder, and tag values when they contain spaces or shell-significant characters."
	],
	seeAlso: ["excli-traverse:reach"]
};
