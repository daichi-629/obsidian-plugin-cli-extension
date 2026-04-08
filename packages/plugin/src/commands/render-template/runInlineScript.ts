import { UserError } from "@sample/core";
import type { TemplateScriptApi } from "./types";

type BuildContextExport = (api: TemplateScriptApi) => Promise<Record<string, unknown> | void>;

function loadBuildContext(scriptSource: string): BuildContextExport {
	const match = scriptSource.match(
		/export\s+async\s+function\s+buildContext\s*\(\s*([A-Za-z_$][\w$]*)?\s*\)\s*{([\s\S]*)}\s*$/
	);
	if (!match) {
		throw new UserError("template-script must export an async buildContext(api) function.");
	}

	const paramName = match[1] || "api";
	const body = match[2];
	return new Function(
		`return async function buildContext(${paramName}) {\n${body}\n};`
	)() as BuildContextExport;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function runInlineTemplateScript(
	scriptSource: string | undefined,
	api: TemplateScriptApi,
	filePath: string
): Promise<Record<string, unknown>> {
	if (!scriptSource) {
		return {};
	}

	try {
		const buildContext = loadBuildContext(scriptSource);
		const result = await buildContext(api);
		if (result === undefined) {
			return {};
		}

		if (!isRecord(result)) {
			throw new UserError(`template-script in "${filePath}" must return an object.`);
		}

		return result;
	} catch (error) {
		if (error instanceof UserError) {
			throw error;
		}

		const message = error instanceof Error ? error.message : "Unknown error";
		throw new UserError(`template-script buildContext() failed for "${filePath}": ${message}`);
	}
}
