import { UserError } from "../../shared/errors/userError";
import { normalizeLineEndings } from "../../shared/text/normalizeLineEndings";
import type { ApplyPatchInput } from "./types";

export function validateApplyPatchInput(input: ApplyPatchInput): ApplyPatchInput {
	const patchText = normalizeLineEndings(input.patchText).trim();
	if (patchText.length === 0) {
		throw new UserError("Patch text must not be empty.");
	}

	return {
		...input,
		patchText
	};
}
