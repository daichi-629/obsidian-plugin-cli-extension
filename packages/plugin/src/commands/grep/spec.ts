import type { CommandSpec } from "../../shared/cli/types";

export const grepCommandSpec: CommandSpec = {
	name: "excli-grep",
	summary: "Search vault files with grep-style output modes.",
	synopsis: [
		"obsidian excli-grep pattern=<pattern> [path=<vault-prefix[,vault-prefix...]>] [exclude-path=<vault-prefix[,vault-prefix...]>] [fixed-strings] [ignore-case] [line-number] [files-with-matches] [count] [before-context=<number>] [after-context=<number>] [context=<number>] [max-results=<number>] [stats] [json]"
	],
	description: [
		"Search vault text files and format the result for CLI automation.",
		"Scanned file extensions come from plugin settings. The vault configuration directory is excluded automatically, and grep path policy is enforced before scanning."
	],
	options: [
		{
			key: "pattern",
			value: "<pattern>",
			description: "Search pattern. Uses regular expressions unless fixed-strings is set.",
			required: true
		},
		{
			key: "path",
			value: "<vault-prefix[,vault-prefix...]>",
			description:
				"Limit the search to one or more vault-relative path prefixes after grep policy checks."
		},
		{
			key: "exclude-path",
			value: "<vault-prefix[,vault-prefix...]>",
			description:
				"Exclude one or more vault-relative path prefixes after include-path filtering."
		},
		{
			key: "fixed-strings",
			description: "Treat the pattern as a fixed substring instead of a regular expression."
		},
		{
			key: "ignore-case",
			description: "Match case-insensitively."
		},
		{
			key: "line-number",
			description: "Include 1-based line numbers in plain-text match output."
		},
		{
			key: "files-with-matches",
			description: "Only print each matched path once instead of printing matching lines."
		},
		{
			key: "count",
			description:
				"Print the number of matched lines per file instead of printing matching lines."
		},
		{
			key: "before-context",
			value: "<number>",
			description: "Print this many lines before each matched line."
		},
		{
			key: "after-context",
			value: "<number>",
			description: "Print this many lines after each matched line."
		},
		{
			key: "context",
			value: "<number>",
			description: "Shorthand for setting both before-context and after-context."
		},
		{
			key: "max-results",
			value: "<number>",
			description: "Stop after this many matched lines."
		},
		{
			key: "stats",
			description:
				"Append filesScanned, matchedFiles, skippedFiles, totalMatches, and stoppedEarly in plain text."
		},
		{
			key: "json",
			description: "Render matches and aggregate search stats as JSON instead of plain text."
		}
	],
	examples: [
		"obsidian excli-grep pattern=TODO",
		"obsidian excli-grep pattern=TODO path=daily/ line-number",
		"obsidian excli-grep pattern=TODO path=projects/,reference/ exclude-path=projects/archive/",
		"obsidian excli-grep pattern='^TODO' ignore-case max-results=5",
		"obsidian excli-grep pattern=TODO count",
		"obsidian excli-grep pattern=TODO context=1 stats",
		"obsidian excli-grep pattern=TODO json"
	],
	notes: [
		"Default plain-text output is `path:text`. With `line-number`, it becomes `path:line:text`. Context lines use `path-line-text`.",
		"`count` already returns one `path:matchCount` row per matched file.",
		"If `files-with-matches` and `count` are both present, `count` takes precedence.",
		"Use `files-with-matches`, `count`, `stats`, or `json` when you need script-friendly output control.",
		"`path` and `exclude-path` accept comma-separated vault-relative prefixes.",
		"`context` counts only matched lines toward `max-results`; surrounding context lines are still printed.",
		"`json` includes statistics directly and ignores the plain-text `stats` appendix.",
		"If no matches are found, the command returns `No matches found.`.",
		"If files are skipped due to read errors, plain-text output appends a trailing warning line.",
		"Search target extensions come from plugin settings.",
		"Quote values that contain spaces or shell-significant characters, for example `pattern='open items'` or `path='meeting notes/'`."
	],
	seeAlso: ["excli-apply-patch"]
};
