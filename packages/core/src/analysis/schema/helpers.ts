import type {
	SchemaGroupBy,
	SchemaPropertySummary,
	SchemaPropertyWarning,
	SchemaValueShape,
	VaultSchemaNote
} from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const WIKILINK_LIST_PATTERN = /^\s*\[\[[^\]]+\]\](?:\s*,\s*\[\[[^\]]+\]\])*\s*$/;

export function sortStrings(values: Iterable<string>): string[] {
	return [...values].sort((left, right) => left.localeCompare(right));
}

export function canonicalizeValue(value: unknown): string {
	if (Array.isArray(value)) {
		return JSON.stringify(value);
	}

	if (value === null) {
		return "null";
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	return String(value);
}

export function normalizeKeyForDuplicateCheck(key: string): string {
	return key.toLowerCase().replace(/[-_\s]+/g, "");
}

function singularize(value: string): string {
	return value.endsWith("s") ? value.slice(0, -1) : value;
}

export function detectDuplicateWarnings(
	summaries: SchemaPropertySummary[]
): Map<string, SchemaPropertyWarning[]> {
	const warnings = new Map<string, SchemaPropertyWarning[]>();

	for (const current of summaries) {
		const currentNormalized = normalizeKeyForDuplicateCheck(current.key);

		for (const other of summaries) {
			if (current.key === other.key) {
				continue;
			}

			const otherNormalized = normalizeKeyForDuplicateCheck(other.key);
			const matchesNormalized = currentNormalized === otherNormalized;
			const matchesSingular = singularize(currentNormalized) === singularize(otherNormalized);
			if ((matchesNormalized || matchesSingular) && current.valueShape === other.valueShape) {
				const existing = warnings.get(current.key) ?? [];
				existing.push({
					type: "possible_duplicate_of",
					detail: other.key
				});
				warnings.set(current.key, existing);
			}
		}
	}

	for (const entry of warnings.values()) {
		entry.sort((left, right) => left.detail.localeCompare(right.detail));
	}

	return warnings;
}

export function detectValueShape(value: unknown): SchemaValueShape {
	if (value === null) {
		return "null";
	}

	if (typeof value === "string") {
		return "string";
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? "number" : "unknown";
	}

	if (typeof value === "boolean") {
		return "boolean";
	}

	if (Array.isArray(value)) {
		return value.every((entry) => typeof entry === "string") ? "string-array" : "unknown";
	}

	return "unknown";
}

export function resolveObservedShape(shapes: SchemaValueShape[]): SchemaValueShape {
	const unique = sortStrings(new Set(shapes)) as SchemaValueShape[];
	if (unique.length === 0) {
		return "unknown";
	}

	if (unique.length === 1) {
		return unique[0] ?? "unknown";
	}

	return "mixed";
}

export function escapeTsvCell(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/\t/g, "\\t")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r");
}

export function detectFormatHint(values: string[]): "date" | "datetime" | "wikilink-list" | null {
	if (values.length === 0) {
		return null;
	}

	const dateMatches = values.filter((value) => DATE_PATTERN.test(value)).length;
	if (dateMatches > values.length / 2) {
		return "date";
	}

	const dateTimeMatches = values.filter((value) => DATETIME_PATTERN.test(value)).length;
	if (dateTimeMatches > values.length / 2) {
		return "datetime";
	}

	const wikilinkMatches = values.filter((value) => WIKILINK_LIST_PATTERN.test(value)).length;
	if (wikilinkMatches > values.length / 2) {
		return "wikilink-list";
	}

	return null;
}

export function detectEnumCandidates(
	valueShape: SchemaValueShape,
	distinctValues: string[],
	coverage: number
): string[] | undefined {
	if (valueShape !== "string" || coverage < 0.1) {
		return undefined;
	}

	const candidates = distinctValues.filter(
		(value) =>
			value.length > 0 &&
			value.length <= 80 &&
			!value.includes("\n") &&
			!DATE_PATTERN.test(value) &&
			!DATETIME_PATTERN.test(value)
	);

	if (candidates.length === 0 || candidates.length > 10) {
		return undefined;
	}

	return sortStrings(new Set(candidates));
}

export function canonicalGroupValue(value: string | number | boolean): string {
	return typeof value === "string" ? value : String(value);
}

export function buildGroupedNotes(
	notes: VaultSchemaNote[],
	groupBy: SchemaGroupBy
): {
	groups: Array<{ value: string; notes: VaultSchemaNote[] }>;
	unassignedCount: number;
	mode: "partition" | "overlap";
} {
	const groups = new Map<string, VaultSchemaNote[]>();
	let unassignedCount = 0;

	if (groupBy.kind === "folder") {
		for (const note of notes) {
			const bucket = groups.get(note.folder) ?? [];
			bucket.push(note);
			groups.set(note.folder, bucket);
		}

		return {
			groups: sortStrings(groups.keys()).map((value) => ({
				value,
				notes: groups.get(value) ?? []
			})),
			unassignedCount,
			mode: "partition"
		};
	}

	if (groupBy.kind === "tag") {
		for (const note of notes) {
			if (note.tags.length === 0) {
				unassignedCount += 1;
				continue;
			}

			for (const tag of note.tags) {
				const bucket = groups.get(tag) ?? [];
				bucket.push(note);
				groups.set(tag, bucket);
			}
		}

		return {
			groups: sortStrings(groups.keys()).map((value) => ({
				value,
				notes: groups.get(value) ?? []
			})),
			unassignedCount,
			mode: "overlap"
		};
	}

	for (const note of notes) {
		const value = note.frontmatter[groupBy.key];
		if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
			unassignedCount += 1;
			continue;
		}

		const bucketKey = canonicalGroupValue(value);
		const bucket = groups.get(bucketKey) ?? [];
		bucket.push(note);
		groups.set(bucketKey, bucket);
	}

	return {
		groups: sortStrings(groups.keys()).map((value) => ({
			value,
			notes: groups.get(value) ?? []
		})),
		unassignedCount,
		mode: "partition"
	};
}
