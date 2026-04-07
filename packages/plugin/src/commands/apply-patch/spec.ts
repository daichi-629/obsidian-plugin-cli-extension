import type { CommandSpec } from "../../shared/cli/types";

export const applyPatchCommandSpec: CommandSpec = {
	name: "sample-monorepo-plugin-apply-patch",
	summary: "Apply a Codex-compatible patch to vault files.",
	synopsis: [
		"obsidian sample-monorepo-plugin-apply-patch patch=<patch> [dry-run] [allow-create] [verbose]",
		"obsidian sample-monorepo-plugin-apply-patch patch-file=<path> [dry-run] [allow-create] [verbose]"
	],
	description: [
		"Apply a Codex-compatible apply_patch document to vault files.",
		"Use this command to add, update, move, or delete files through the vault adapter."
	],
	options: [
		{
			key: "patch",
			value: "<patch>",
			description: "Patch text in Codex apply_patch format."
		},
		{
			key: "patch-file",
			value: "<path>",
			description: "Read patch text from a filesystem path or vault:path."
		},
		{
			key: "dry-run",
			description: "Validate and preview changes without writing files."
		},
		{
			key: "allow-create",
			description: "Allow Add File operations."
		},
		{
			key: "verbose",
			description: "Include detailed per-file output."
		}
	],
	examples: [
		"obsidian sample-monorepo-plugin-apply-patch patch-file=tmp/change.patch dry-run",
		"obsidian sample-monorepo-plugin-apply-patch patch-file=vault:tmp/change.patch allow-create verbose"
	],
	notes: [
		"Specify exactly one of `patch` or `patch-file`.",
		"`allow-create` is required for Add File operations."
	],
	seeAlso: ["sample-monorepo-plugin-grep"]
};
