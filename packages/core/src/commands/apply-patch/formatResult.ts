import type { ApplyPatchFileResult, ApplyPatchResult } from "./types";

function titleCaseOperation(operation: ApplyPatchFileResult["operation"]): string {
	switch (operation) {
		case "add":
			return "Added";
		case "delete":
			return "Deleted";
		case "move":
			return "Moved";
		case "update":
			return "Updated";
	}
}

function formatPath(result: ApplyPatchFileResult): string {
	if (result.operation === "move" && result.nextPath) {
		return `${result.path} -> ${result.nextPath}`;
	}

	return result.path;
}

function formatFileLine(result: ApplyPatchFileResult, verbose: boolean): string {
	if (result.status === "failed") {
		return result.message
			? `Failed: ${formatPath(result)} - ${result.message}`
			: `Failed: ${formatPath(result)}`;
	}

	if (result.status === "skipped") {
		return result.message
			? `Skipped: ${formatPath(result)} - ${result.message}`
			: `Skipped: ${formatPath(result)}`;
	}

	if (verbose && result.message) {
		return `${titleCaseOperation(result.operation)}: ${formatPath(result)} - ${result.message}`;
	}

	return `${titleCaseOperation(result.operation)}: ${formatPath(result)}`;
}

export function formatApplyPatchResult(
	result: ApplyPatchResult,
	options: Pick<ApplyPatchResult, "dryRun"> & { verbose: boolean }
): string {
	const failedCount = result.files.filter((file) => file.status === "failed").length;
	let headline: string;

	if (failedCount > 0) {
		headline = `Patch partially applied. ${result.changedFileCount} of ${result.files.length} files changed.`;
	} else if (options.dryRun) {
		headline = `Dry run completed. ${result.changedFileCount} file changes planned.`;
	} else {
		headline = `Applied patch to ${result.changedFileCount} files.`;
	}

	const details = result.files.map((file) => formatFileLine(file, options.verbose));
	return [headline, ...details].join("\n");
}
