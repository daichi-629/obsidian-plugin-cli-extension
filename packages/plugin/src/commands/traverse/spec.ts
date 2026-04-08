import type { CommandSpec } from "../../shared/cli/types";

export const traverseReachCommandSpec: CommandSpec = {
	name: "excli-traverse:reach",
	summary: "Traverse the vault link graph outward from one seed note.",
	synopsis: [
		"obsidian excli-traverse:reach from=<path-or-linkpath> [depth=<n>] [direction=<out|in|both>] [folder=<path>] [tag=<tag>] [format=<text|json|tsv>]"
	],
	description: [
		"Run a deterministic breadth-first traversal from one seed note over the resolved markdown link graph.",
		"folder and tag constrain the subgraph before traversal, not after formatting."
	],
	options: [
		{
			key: "from",
			value: "<path-or-linkpath>",
			description: "Seed note as a vault-relative path or internal link path.",
			required: true
		},
		{ key: "depth", value: "<n>", description: "Maximum hop depth as a non-negative integer." },
		{
			key: "direction",
			value: "<out|in|both>",
			description: "Traverse outgoing links, backlinks, or an undirected projection."
		},
		{
			key: "folder",
			value: "<path>",
			description: "Limit the graph scope to a vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit the graph scope to notes that include the given tag."
		},
		{
			key: "format",
			value: "<text|json|tsv>",
			description: "Render text, JSON, or TSV output."
		}
	],
	notes: [
		"path-or-linkpath accepts canonical note paths like projects/atlas.md, extensionless paths like projects/atlas, and unique basenames like Atlas.",
		"Large depth values can return large neighborhoods because v1 does not truncate results."
	],
	seeAlso: ["excli-traverse:path", "excli-traverse:clusters"]
};

export const traversePathCommandSpec: CommandSpec = {
	name: "excli-traverse:path",
	summary: "Return the deterministic shortest path between two notes.",
	synopsis: [
		"obsidian excli-traverse:path from=<path-or-linkpath> to=<path-or-linkpath> [direction=<out|both>] [folder=<path>] [tag=<tag>] [format=<text|json|tsv>]"
	],
	description: [
		"Run an unweighted shortest-path search over the selected graph scope.",
		"Path not found is a normal empty result, not a usage failure."
	],
	options: [
		{
			key: "from",
			value: "<path-or-linkpath>",
			description: "Start note as a vault-relative path or internal link path.",
			required: true
		},
		{
			key: "to",
			value: "<path-or-linkpath>",
			description: "Target note as a vault-relative path or internal link path.",
			required: true
		},
		{
			key: "direction",
			value: "<out|both>",
			description: "Follow outgoing links only, or treat the graph as undirected."
		},
		{
			key: "folder",
			value: "<path>",
			description: "Limit the graph scope to a vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit the graph scope to notes that include the given tag."
		},
		{
			key: "format",
			value: "<text|json|tsv>",
			description: "Render text, JSON, or TSV output."
		}
	],
	notes: [
		"path-or-linkpath accepts canonical note paths like projects/atlas.md, extensionless paths like projects/atlas, and unique basenames like Atlas."
	],
	seeAlso: ["excli-traverse:reach", "excli-traverse:clusters"]
};

export const traverseClustersCommandSpec: CommandSpec = {
	name: "excli-traverse:clusters",
	summary: "List weakly connected note clusters in the selected graph scope.",
	synopsis: [
		"obsidian excli-traverse:clusters [folder=<path>] [tag=<tag>] [min-size=<n>] [format=<text|json|tsv>]"
	],
	description: [
		"Find weakly connected components in the selected subgraph.",
		"folder and tag constrain the graph scope before component detection."
	],
	options: [
		{
			key: "folder",
			value: "<path>",
			description: "Limit the graph scope to a vault-relative folder prefix."
		},
		{
			key: "tag",
			value: "<tag>",
			description: "Limit the graph scope to notes that include the given tag."
		},
		{
			key: "min-size",
			value: "<n>",
			description: "Only display components at or above this positive size."
		},
		{
			key: "format",
			value: "<text|json|tsv>",
			description: "Render text, JSON, or TSV output."
		}
	],
	notes: ["Only one folder and one tag filter are supported in v1."],
	seeAlso: ["excli-traverse:reach", "excli-traverse:path"]
};
