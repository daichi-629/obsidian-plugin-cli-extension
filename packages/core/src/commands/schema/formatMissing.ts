import type { MissingPropertyResult } from "../../analysis/schema";

export function formatMissingResult(
	result: MissingPropertyResult,
	format: "text" | "json" | "tsv"
): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (format === "tsv") {
		return result.paths.join("\n");
	}

	if (result.paths.length === 0) {
		return `No notes are missing '${result.key}'.`;
	}

	return `${result.paths.join("\n")}\n${result.missingCount} notes are missing '${result.key}'.`;
}
