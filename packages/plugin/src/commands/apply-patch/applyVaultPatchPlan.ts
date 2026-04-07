import {
	UserError,
	executeApplyPatchUpdate,
	type ApplyPatchOperation,
	type ApplyPatchPlan,
	type ApplyPatchResult
} from "@sample/core";
import { TFile, normalizePath, type Plugin } from "obsidian";

function normalizeVaultTargetPath(path: string, configDir: string): string {
	const normalized = normalizePath(path);
	const segments = normalized.split("/");

	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
	) {
		throw new UserError(`Invalid vault path: ${path}`);
	}

	if (normalized === configDir || normalized.startsWith(`${configDir}/`)) {
		throw new UserError(`Editing '${configDir}' is not allowed: ${path}`);
	}

	return normalized;
}

async function ensureParentFolders(plugin: Plugin, path: string): Promise<void> {
	const segments = path.split("/");
	let currentPath = "";

	for (let index = 0; index < segments.length - 1; index += 1) {
		currentPath = currentPath ? `${currentPath}/${segments[index]}` : segments[index];
		if (!plugin.app.vault.getFolderByPath(currentPath)) {
			await plugin.app.vault.createFolder(currentPath);
		}
	}
}

function restoreLineEndings(content: string, originalContent: string): string {
	if (originalContent.includes("\r\n")) {
		return content.replace(/\n/g, "\r\n");
	}

	return content;
}

function readFileForOperation(plugin: Plugin, path: string): TFile {
	const file = plugin.app.vault.getFileByPath(path);
	if (!file) {
		throw new UserError(`File does not exist: ${path}`);
	}

	return file;
}

async function applyOperation(
	plugin: Plugin,
	operation: ApplyPatchOperation,
	dryRun: boolean
): Promise<ApplyPatchResult["files"][number]> {
	const configDir = plugin.app.vault.configDir;

	if (operation.type === "add") {
		const path = normalizeVaultTargetPath(operation.path, configDir);
		if (plugin.app.vault.getAbstractFileByPath(path)) {
			throw new UserError(`Cannot add a file that already exists: ${path}`);
		}

		if (!dryRun) {
			await ensureParentFolders(plugin, path);
			await plugin.app.vault.create(path, operation.contents);
		}

		return {
			path,
			operation: "add",
			status: dryRun ? "planned" : "applied"
		};
	}

	if (operation.type === "delete") {
		const path = normalizeVaultTargetPath(operation.path, configDir);
		const file = readFileForOperation(plugin, path);

		if (!dryRun) {
			await plugin.app.fileManager.trashFile(file);
		}

		return {
			path,
			operation: "delete",
			status: dryRun ? "planned" : "applied"
		};
	}

	const path = normalizeVaultTargetPath(operation.path, configDir);
	const moveTo = operation.moveTo
		? normalizeVaultTargetPath(operation.moveTo, configDir)
		: undefined;
	const file = readFileForOperation(plugin, path);
	const currentContent = await plugin.app.vault.read(file);
	const execution = executeApplyPatchUpdate({
		path,
		moveTo,
		chunks: operation.chunks,
		currentContent
	});

	if (moveTo && moveTo !== path && plugin.app.vault.getAbstractFileByPath(moveTo)) {
		throw new UserError(`Cannot move to an existing path: ${moveTo}`);
	}

	if (!dryRun) {
		if (execution.renamed && moveTo) {
			await ensureParentFolders(plugin, moveTo);
			await plugin.app.fileManager.renameFile(file, moveTo);
		}

		if (execution.changed) {
			const targetFile = plugin.app.vault.getFileByPath(moveTo ?? path);
			if (!targetFile) {
				throw new UserError(`File does not exist after rename: ${moveTo ?? path}`);
			}

			await plugin.app.vault.modify(
				targetFile,
				restoreLineEndings(execution.nextContent, currentContent)
			);
		}
	}

	return {
		path,
		nextPath: moveTo,
		operation: execution.renamed ? "move" : "update",
		status: dryRun ? "planned" : "applied"
	};
}

export async function applyVaultPatchPlan(
	plugin: Plugin,
	plan: ApplyPatchPlan,
	options: { dryRun: boolean }
): Promise<ApplyPatchResult> {
	const files: ApplyPatchResult["files"] = [];
	let changedFileCount = 0;
	let failureEncountered = false;

	for (let index = 0; index < plan.operations.length; index += 1) {
		const operation = plan.operations[index];

		if (failureEncountered) {
			files.push({
				path: operation.path,
				nextPath: operation.type === "update" ? operation.moveTo : undefined,
				operation:
					operation.type === "update" && operation.moveTo ? "move" : operation.type,
				status: "skipped"
			});
			continue;
		}

		try {
			const result = await applyOperation(plugin, operation, options.dryRun);
			files.push(result);
			changedFileCount += 1;
		} catch (error) {
			files.push({
				path: operation.path,
				nextPath: operation.type === "update" ? operation.moveTo : undefined,
				operation:
					operation.type === "update" && operation.moveTo ? "move" : operation.type,
				status: "failed",
				message: error instanceof Error ? error.message : "Patch operation failed."
			});
			failureEncountered = true;
		}
	}

	return {
		files,
		changedFileCount,
		dryRun: options.dryRun
	};
}
