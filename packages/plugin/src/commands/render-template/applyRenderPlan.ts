import type { Plugin } from "obsidian";
import { UserError, type OverwritePolicy, type PathConflictPolicy, type RenderTemplatePlan, type RenderTemplateResult } from "@sample/core";
import {
	getTemplateOutputPathPolicyError,
	type TemplateCommandSettings
} from "../../settings/templateCommand";

function extname(filePath: string): string {
	const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
	const name = parts.length > 0 ? parts[parts.length - 1] : "";
	const index = name.lastIndexOf(".");
	return index <= 0 ? "" : name.slice(index);
}

function dirname(filePath: string): string {
	const segments = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
	return segments.length <= 1 ? "." : segments.slice(0, -1).join("/");
}

function resolveSuffixedPath(basePath: string, existing: Set<string>): string {
	const extension = extname(basePath);
	const basename = extension ? basePath.slice(0, -extension.length) : basePath;
	let counter = 2;
	let candidate = `${basename}-${counter}${extension}`;
	while (existing.has(candidate)) {
		counter += 1;
		candidate = `${basename}-${counter}${extension}`;
	}

	return candidate;
}

async function ensureFolders(plugin: Plugin, filePath: string): Promise<void> {
	const parent = dirname(filePath);
	if (parent === "." || parent.length === 0) {
		return;
	}

	const segments = parent.split("/");
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!plugin.app.vault.getAbstractFileByPath(current)) {
			await plugin.app.vault.createFolder(current);
		}
	}
}

export async function applyRenderPlan(
	plugin: Plugin,
	plan: RenderTemplatePlan,
	options: {
		existingFile: OverwritePolicy;
		duplicateOutput: PathConflictPolicy;
		settings: TemplateCommandSettings;
	}
): Promise<RenderTemplateResult> {
	if (plan.files.length > options.settings.maxRenderedFiles) {
		throw new UserError(
			`Bundle output count ${plan.files.length} exceeds maxRenderedFiles ${options.settings.maxRenderedFiles}.`
		);
	}

	const existingPaths = new Set(plugin.app.vault.getFiles().map((file) => file.path));
	const plannedPaths = new Set<string>();
	const resultFiles: RenderTemplateResult["files"] = [];

	for (const file of plan.files) {
		const policyError = getTemplateOutputPathPolicyError(
			file.path,
			options.settings,
			plugin.app.vault.configDir
		);
		if (policyError) {
			throw new UserError(policyError);
		}

		let targetPath = file.path;
		if (plannedPaths.has(targetPath)) {
			if (options.duplicateOutput === "suffix") {
				targetPath = resolveSuffixedPath(targetPath, new Set([...existingPaths, ...plannedPaths]));
			} else if (options.duplicateOutput === "fail") {
				throw new UserError(`Rendered path "${targetPath}" is duplicated within the render plan.`);
			}
		}

		const abstractFile = plugin.app.vault.getAbstractFileByPath(targetPath);
		const existingFile = plugin.app.vault.getFiles().find((candidate) => candidate.path === targetPath);
		const existsAsFile = existingFile !== undefined;
		if (abstractFile && !existsAsFile) {
			throw new UserError(`Rendered path "${targetPath}" already exists as a folder.`);
		}
		if (existsAsFile) {
			if (options.existingFile === "skip") {
				plannedPaths.add(targetPath);
				resultFiles.push({
					path: targetPath,
					template: file.template,
					status: "skipped",
					bytes: file.bytes
				});
				continue;
			}

			if (options.existingFile === "fail") {
				throw new UserError(`Rendered path "${targetPath}" already exists.`);
			}
		}

		const status =
			plan.dryRun || !existsAsFile ? (plan.dryRun ? "planned" : "created") : "replaced";

		if (!plan.dryRun) {
			await ensureFolders(plugin, targetPath);
			if (existsAsFile) {
				await plugin.app.vault.modify(existingFile, file.content);
			} else {
				await plugin.app.vault.create(targetPath, file.content);
			}
		}

		existingPaths.add(targetPath);
		plannedPaths.add(targetPath);
		resultFiles.push({
			path: targetPath,
			template: file.template,
			status,
			bytes: file.bytes
		});
	}

	return {
		template: plan.template,
		mode: plan.mode,
		dryRun: plan.dryRun,
		files: resultFiles
	};
}
