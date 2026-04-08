import { UserError, parseInlineTemplateScript, parseTemplateManifest } from "@sample/core";
import type { TAbstractFile, TFile, TFolder } from "obsidian";
import type { Plugin } from "obsidian";
import type { TemplateCommandSettings } from "../../settings/templateCommand";
import type { ResolvedTemplateSource } from "./types";

function isTFile(file: TAbstractFile | null): file is TFile {
	return Boolean(file && "extension" in file);
}

function isTFolder(file: TAbstractFile | null): file is TFolder {
	return Boolean(file && "children" in file && !("extension" in file));
}

function normalizeTemplatePath(template: string, settings: TemplateCommandSettings): string {
	if (template.startsWith("vault:")) {
		return template.slice("vault:".length).replace(/^\/+/, "");
	}

	if (template.includes("/")) {
		return template.replace(/^\/+/, "");
	}

	return `${settings.templateRoot}${template}`.replace(/^\/+/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceScalar(value: string): unknown {
	if (value === "true") {
		return true;
	}

	if (value === "false") {
		return false;
	}

	if (value === "null") {
		return null;
	}

	if (/^-?\d+$/.test(value)) {
		return Number.parseInt(value, 10);
	}

	if (/^-?\d*\.\d+$/.test(value)) {
		return Number.parseFloat(value);
	}

	if (
		(value.startsWith("[") && value.endsWith("]")) ||
		(value.startsWith("{") && value.endsWith("}"))
	) {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	return value;
}

function parseSimpleFrontmatter(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	let activeKey: string | undefined;
	let activeList: unknown[] | undefined;

	for (const rawLine of yaml.split(/\r?\n/)) {
		const line = rawLine.replace(/\t/g, "    ");
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			continue;
		}

		if (trimmed.startsWith("- ") && activeKey && activeList) {
			activeList.push(coerceScalar(trimmed.slice(2).trim()));
			continue;
		}

		const separatorIndex = trimmed.indexOf(":");
		if (separatorIndex <= 0) {
			activeKey = undefined;
			activeList = undefined;
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		const value = trimmed.slice(separatorIndex + 1).trim();
		if (value.length === 0) {
			activeKey = key;
			activeList = [];
			result[key] = activeList;
			continue;
		}

		result[key] = coerceScalar(value);
		activeKey = undefined;
		activeList = undefined;
	}

	return result;
}

function extractMarkdownFrontmatter(text: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: text };
	}

	return {
		frontmatter: parseSimpleFrontmatter(match[1]),
		body: match[2]
	};
}

async function collectFolderFiles(folder: TFolder): Promise<TFile[]> {
	const results: TFile[] = [];
	const stack: TAbstractFile[] = [...folder.children];
	while (stack.length > 0) {
		const current = stack.pop() as TAbstractFile;
		if (isTFolder(current)) {
			stack.push(...current.children);
			continue;
		}

		results.push(current);
	}

	return results;
}

async function resolveConventionBundle(
	plugin: Plugin,
	folder: TFolder
): Promise<ResolvedTemplateSource> {
	const files = await collectFolderFiles(folder);
	const manifest = {
		version: 1 as const,
		partialsDir: "partials",
		defaults: undefined as Record<string, unknown> | undefined,
		defaultDataFiles: [] as string[],
		outputs: [] as Array<{ template: string; path: string }>
	};
	const templateFiles: Record<string, string> = {};
	const partials: Record<string, string> = {};

	for (const file of files) {
		const relativePath = file.path.slice(`${folder.path}/`.length);
		if (relativePath === "template.json") {
			continue;
		}

		const contents = await plugin.app.vault.cachedRead(file);
		const { frontmatter, body } = extractMarkdownFrontmatter(contents);

		if (relativePath === "defaults.md") {
			manifest.defaults = isRecord(frontmatter) ? frontmatter : undefined;
			continue;
		}

		if (relativePath.startsWith("partials/")) {
			parseInlineTemplateScript(body, { allow: false, path: file.path });
			partials[relativePath.slice("partials/".length)] = body;
			continue;
		}

		if (file.extension !== "md") {
			continue;
		}

		const outputPath =
			typeof frontmatter.output === "string" && frontmatter.output.length > 0
				? frontmatter.output
				: relativePath;

		manifest.outputs.push({
			template: relativePath,
			path: outputPath
		});
		templateFiles[relativePath] = body;
	}

	if (manifest.outputs.length === 0) {
		throw new UserError("Template bundle must contain at least one template markdown file.");
	}

	if (Object.keys(partials).length === 0) {
		manifest.partialsDir = undefined;
	}

	return {
		mode: "bundle",
		templateRootPath: folder.path,
		manifest,
		templateFiles,
		partials
	};
}

export async function resolveTemplateSource(
	plugin: Plugin,
	template: string,
	settings: TemplateCommandSettings
): Promise<ResolvedTemplateSource> {
	const resolvedPath = normalizeTemplatePath(template, settings);
	const abstractFile = plugin.app.vault.getAbstractFileByPath(resolvedPath);
	if (!abstractFile) {
		throw new UserError(`Template "${template}" could not be resolved in the vault.`);
	}

	if (isTFile(abstractFile)) {
		return {
			mode: "single-file",
			templatePath: abstractFile.path,
			templateContent: await plugin.app.vault.cachedRead(abstractFile)
		};
	}

	if (!isTFolder(abstractFile)) {
		throw new UserError(`Template "${template}" could not be resolved in the vault.`);
	}

	const manifestFile = plugin.app.vault.getAbstractFileByPath(
		`${abstractFile.path}/template.json`
	);
	if (!manifestFile) {
		return resolveConventionBundle(plugin, abstractFile);
	}

	if (!isTFile(manifestFile)) {
		throw new UserError("Template bundle is missing template.json.");
	}

	const manifest = parseTemplateManifest(await plugin.app.vault.cachedRead(manifestFile));
	const templateFiles: Record<string, string> = {};
	for (const output of manifest.outputs) {
		const outputFile = plugin.app.vault.getAbstractFileByPath(
			`${abstractFile.path}/${output.template}`
		);
		if (!outputFile || !isTFile(outputFile)) {
			throw new UserError(`Template file "${output.template}" is missing from the bundle.`);
		}

		templateFiles[output.template] = await plugin.app.vault.cachedRead(outputFile);
	}

	const partials: Record<string, string> = {};
	if (manifest.partialsDir) {
		const partialRoot = plugin.app.vault.getAbstractFileByPath(
			`${abstractFile.path}/${manifest.partialsDir}`
		);
		if (!partialRoot || !isTFolder(partialRoot)) {
			throw new UserError(
				`Template partials directory "${manifest.partialsDir}" is missing.`
			);
		}

		const stack = [...partialRoot.children];
		while (stack.length > 0) {
			const current = stack.pop() as TAbstractFile;
			if (isTFolder(current)) {
				stack.push(...current.children);
				continue;
			}

			const relativePath = current.path.slice(
				`${abstractFile.path}/${manifest.partialsDir}/`.length
			);
			const contents = await plugin.app.vault.cachedRead(current);
			parseInlineTemplateScript(contents, { allow: false, path: current.path });
			partials[relativePath] = contents;
		}
	}

	return {
		mode: "bundle",
		templateRootPath: abstractFile.path,
		manifest,
		templateFiles,
		partials
	};
}
