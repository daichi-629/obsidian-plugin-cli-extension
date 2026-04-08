import { UserError } from "../../shared/errors/userError";
import type { TemplateBundleManifest, TemplateBundleManifestOutput } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeRelativePath(input: string, label: string): string {
	const normalized = input.trim().replace(/\\/g, "/");
	if (normalized.length === 0) {
		throw new UserError(`${label} must not be empty.`);
	}

	if (
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		normalized.split("/").includes("..")
	) {
		throw new UserError(`${label} must stay within the template bundle.`);
	}

	return normalized.replace(/^\.\/+/, "");
}

function parseOutput(value: unknown): TemplateBundleManifestOutput {
	if (!isRecord(value)) {
		throw new UserError("Template bundle outputs must be objects.");
	}

	if (typeof value.template !== "string" || typeof value.path !== "string") {
		throw new UserError(
			'Each template bundle output must include string "template" and "path".'
		);
	}

	return {
		template: normalizeRelativePath(value.template, "Bundle output template"),
		path: value.path
	};
}

export function parseTemplateManifest(text: string): TemplateBundleManifest {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new UserError("Template bundle manifest must be valid JSON.");
	}

	if (!isRecord(parsed)) {
		throw new UserError("Template bundle manifest must be a JSON object.");
	}

	if (parsed.version !== 1) {
		throw new UserError("Template bundle manifest version must be 1.");
	}

	const outputs = Array.isArray(parsed.outputs) ? parsed.outputs.map(parseOutput) : [];
	if (outputs.length === 0) {
		throw new UserError("Template bundle manifest must define at least one output.");
	}

	const defaults =
		parsed.defaults === undefined
			? undefined
			: isRecord(parsed.defaults)
				? parsed.defaults
				: (() => {
						throw new UserError('Template bundle "defaults" must be an object.');
					})();

	const defaultDataFiles = Array.isArray(parsed.defaultDataFiles)
		? parsed.defaultDataFiles.map((entry) => {
				if (typeof entry !== "string" || !entry.endsWith(".json")) {
					throw new UserError(
						"Template bundle defaultDataFiles must be JSON file paths."
					);
				}

				return normalizeRelativePath(entry, "Bundle default data file");
			})
		: [];

	const partialsDir =
		typeof parsed.partialsDir === "string"
			? normalizeRelativePath(parsed.partialsDir, "Bundle partialsDir")
			: undefined;

	return {
		version: 1,
		description: typeof parsed.description === "string" ? parsed.description : undefined,
		partialsDir,
		defaults,
		defaultDataFiles,
		outputs
	};
}
