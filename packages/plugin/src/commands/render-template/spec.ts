import type { CommandSpec } from "../../shared/cli/types";

export const renderTemplateCommandSpec: CommandSpec = {
	name: "excli-render-template",
	summary: "Render a vault template file or template bundle into one or more notes.",
	synopsis: [
		"obsidian excli-render-template template=<path-or-id> [destination=<path-template-or-root>] [write=<apply|dry-run>] [stdout=<status/text|status/json|content/text|status+content/text|status+content/json>] [existing-file=<fail|replace|skip>] [duplicate-output=<fail|suffix|overwrite>] [data-file=<path>]... [data=<json-object>] [set=<key=value>]..."
	],
	description: [
		"Render a single template file or a template bundle from the vault.",
		"`destination` means the output path template for a single file, or the output root for a bundle.",
		"`write` controls vault writes and `stdout` controls CLI output, so preview and write behavior are independent."
	],
	options: [
		{ key: "template", value: "<path-or-id>", description: "Vault template path or bare template id.", required: true },
		{ key: "destination", value: "<path-template-or-root>", description: "Single-file destination path template, or bundle destination root. Required in single-file mode." },
		{ key: "write", value: "<apply|dry-run>", description: "Whether to write into the vault or just plan the render." },
		{ key: "stdout", value: "<status/text|status/json|content/text|status+content/text|status+content/json>", description: "Choose summary/content payload and output format." },
		{ key: "existing-file", value: "<fail|replace|skip>", description: "How to handle an existing vault file at the final destination path." },
		{ key: "duplicate-output", value: "<fail|suffix|overwrite>", description: "How bundle renders handle duplicate destination paths within one run." },
		{ key: "data-file", value: "<path>", description: "JSON data file. Repeat the option to merge multiple files. Use vault: for vault-relative reads." },
		{ key: "data", value: "<json-object>", description: "Inline JSON object merged into template data." },
		{ key: "set", value: "<key=value>", description: "Convenience scalar assignments with dotted keys. Repeatable." }
	],
	examples: [
		"obsidian excli-render-template template=daily-template.md destination='daily/<%= it._system.date %>-<%= it.path.shortId() %>.md' set=title=Daily",
		"obsidian excli-render-template template=project-scaffold destination='projects/atlas' existing-file=replace data='{\"title\":\"Atlas\"}'",
		"obsidian excli-render-template template=meeting-template.md destination='meetings/<%= it.path.slug(it.data.title) %>.md' write=dry-run stdout=content/text data='{\"title\":\"Weekly Sync\"}'"
	],
	notes: [
		"Single-file mode requires `destination`; bundle mode can omit it and use manifest-relative output paths from the vault root.",
		"Bundle mode uses `template.json` when present. Without it, markdown files are discovered by convention and `defaults.md` frontmatter becomes bundle defaults.",
		"`data-file` and `set` are repeatable.",
		"`duplicate-output` is only valid for bundle mode."
	],
	seeAlso: ["excli-apply-patch", "excli-grep"]
};
