import { UserError } from "../../shared/errors/userError";
import type {
	OverwritePolicy,
	PathConflictPolicy,
	RenderTemplateOptions,
	RenderTemplateStdoutMode,
	RenderTemplateOptionsInput
} from "./types";

function parseOverwritePolicy(value: string | undefined): OverwritePolicy {
	if (value === undefined) {
		return "fail";
	}

	if (value === "fail" || value === "replace" || value === "skip") {
		return value;
	}

	throw new UserError("The --existing-file option must be fail, replace, or skip.");
}

function parsePathConflictPolicy(value: string | undefined): PathConflictPolicy {
	if (value === undefined) {
		return "fail";
	}

	if (value === "fail" || value === "suffix" || value === "overwrite") {
		return value;
	}

	throw new UserError("The --duplicate-output option must be fail, suffix, or overwrite.");
}

function parseStdoutMode(value: string | undefined): RenderTemplateStdoutMode {
	if (value === undefined) {
		return "status/text";
	}

	if (
		value === "status/text" ||
		value === "status/json" ||
		value === "content/text" ||
		value === "status+content/text" ||
		value === "status+content/json"
	) {
		return value;
	}

	throw new UserError(
		"The --stdout option must be status/text, status/json, content/text, status+content/text, or status+content/json."
	);
}

export function parseRenderTemplateOptions(
	input: RenderTemplateOptionsInput
): RenderTemplateOptions {
	const existingFile = parseOverwritePolicy(input.existingFile);
	const duplicateOutput = parsePathConflictPolicy(input.duplicateOutput);
	const write =
		input.write === undefined
			? "apply"
			: input.write === "dry-run"
				? "dry-run"
				: input.write === "apply"
					? "apply"
					: undefined;
	if (!write) {
		throw new UserError("The --write option must be apply or dry-run.");
	}

	const stdout = parseStdoutMode(input.stdout);
	const dryRun = write === "dry-run";

	if (input.mode === "single-file") {
		if (input.destination === undefined) {
			throw new UserError(
				"The --destination option is required when template points to a file."
			);
		}

		if (input.duplicateOutput !== undefined) {
			throw new UserError(
				"The --duplicate-output option is only valid when template points to a directory."
			);
		}
	}

	return {
		template: input.template,
		mode: input.mode,
		destination: input.destination,
		write,
		stdout,
		existingFile,
		duplicateOutput,
		dryRun,
		maxRenderedFiles: input.maxRenderedFiles
	};
}
