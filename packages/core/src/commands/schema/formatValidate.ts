import type { SchemaValidationBatchResult } from "../../analysis/schema";

export function formatValidateResult(
	result: SchemaValidationBatchResult,
	format: "text" | "json"
): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	const lines = [
		`Schema validation for ${result.targets.noteCount} notes: ${result.failed ? "fail" : "pass"}`
	];

	for (const entry of result.results) {
		lines.push(`${entry.path}: ${entry.valid ? "valid" : "invalid"}`);
		for (const issue of entry.issues) {
			lines.push(
				`  [${issue.severity}] ${issue.key} ${issue.issue}${
					issue.note ? ` (${issue.note})` : ""
				}`
			);
		}
	}

	return lines.join("\n");
}
