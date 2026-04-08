import { UserError } from "../../shared/errors/userError";
import type { ParsedInlineScript } from "./types";

const INLINE_SCRIPT_PATTERN =
	/^(?:\uFEFF)?```template-script\r?\n([\s\S]*?)\r?\n```\r?\n?([\s\S]*)$/;

export function parseInlineTemplateScript(
	text: string,
	options?: { allow?: boolean; path?: string }
): ParsedInlineScript {
	const match = text.match(INLINE_SCRIPT_PATTERN);
	if (!match) {
		return { templateBody: text };
	}

	if (options?.allow === false) {
		const filePath = options.path ? `"${options.path}" ` : "";
		throw new UserError(`Partial file ${filePath}must not contain a template-script block.`);
	}

	return {
		scriptSource: match[1],
		templateBody: match[2]
	};
}
