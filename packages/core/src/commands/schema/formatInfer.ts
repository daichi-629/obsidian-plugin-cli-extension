import { escapeTsvCell } from "../../analysis/schema/helpers";
import type {
	GroupedSchemaSummary,
	SchemaPropertySummary,
	SchemaSummary
} from "../../analysis/schema";

function coveragePercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function renderPropertyLine(property: SchemaPropertySummary): string {
	const extras: string[] = [];
	if (property.enumCandidates && property.enumCandidates.length > 0) {
		extras.push(`enum=${property.enumCandidates.join(",")}`);
	}
	if (property.formatHint) {
		extras.push(`format=${property.formatHint}`);
	}
	if (property.warnings.length > 0) {
		extras.push(
			`warnings=${property.warnings.map((warning) => `${warning.type}:${warning.detail}`).join(",")}`
		);
	}

	return [
		`${property.key}`,
		`${property.valueShape}`,
		`${coveragePercent(property.coverage)}`,
		`${property.presentIn}/${property.noteCount}`,
		extras.length > 0 ? `(${extras.join("; ")})` : ""
	]
		.filter((part) => part.length > 0)
		.join(" ");
}

function renderPlainSummary(summary: SchemaSummary): string {
	const lines = [
		`Schema inferred from ${summary.scope.noteCount} notes. folder=${summary.scope.folder ?? "*"} tag=${summary.scope.tag ?? "*"}`
	];

	for (const property of summary.properties) {
		lines.push(renderPropertyLine(property));
	}

	return lines.join("\n");
}

function renderGroupedText(summary: GroupedSchemaSummary): string {
	const lines = [
		`Schema inferred from ${summary.scope.noteCount} notes grouped by ${summary.groupBy.kind}${summary.groupBy.key ? `:${summary.groupBy.key}` : ""}.`
	];

	for (const group of summary.groups) {
		lines.push("");
		lines.push(`[${group.value}] ${group.noteCount} notes`);
		for (const property of group.properties) {
			lines.push(renderPropertyLine(property));
		}
	}

	return lines.join("\n");
}

function renderTsvRows(
	properties: SchemaPropertySummary[],
	prefix?: Record<string, string>
): string[] {
	return properties.map((property) =>
		[
			...(prefix
				? [prefix.group_by_kind, prefix.group_by_key, prefix.group_value, prefix.group_note_count]
				: []),
			property.key,
			property.obsidianType ?? "",
			property.valueShape,
			String(property.presentIn),
			String(property.noteCount),
			String(property.coverage),
			property.enumCandidates?.join(",") ?? "",
			property.warnings.map((warning) => `${warning.type}:${warning.detail}`).join(",")
		]
			.map(escapeTsvCell)
			.join("\t")
	);
}

export function formatInferResult(result: SchemaSummary | GroupedSchemaSummary, format: "text" | "json" | "tsv"): string {
	if (format === "json") {
		return JSON.stringify(result, null, 2);
	}

	if (format === "text") {
		return "properties" in result ? renderPlainSummary(result) : renderGroupedText(result);
	}

	const header = [
		...("groups" in result
			? ["group_by_kind", "group_by_key", "group_value", "group_note_count"]
			: []),
		"key",
		"obsidian_type",
		"value_shape",
		"present_in",
		"note_count",
		"coverage",
		"enum_candidates",
		"warnings"
	].join("\t");

	const rows =
		"properties" in result
			? renderTsvRows(result.properties)
			: result.groups.flatMap((group) =>
					renderTsvRows(group.properties, {
						group_by_kind: result.groupBy.kind,
						group_by_key: result.groupBy.key ?? "",
						group_value: group.value,
						group_note_count: String(group.noteCount)
					})
			  );

	return [header, ...rows].join("\n");
}
