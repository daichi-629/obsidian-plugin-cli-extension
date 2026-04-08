import {
	buildGroupedNotes,
	canonicalizeValue,
	detectDuplicateWarnings,
	detectEnumCandidates,
	detectFormatHint,
	detectValueShape,
	resolveObservedShape,
	sortStrings
} from "./helpers";
import type {
	GroupedSchemaSummary,
	InferSchemaInput,
	SchemaPropertySummary,
	SchemaSummary,
	SchemaValueShape,
	VaultSchemaNote
} from "./types";

type PropertyAccumulator = {
	presentIn: number;
	shapes: SchemaValueShape[];
	scalarValues: Set<string>;
	examples: Map<string, string>;
	stringValues: string[];
};

function summarizeProperties(
	notes: VaultSchemaNote[],
	propertyCatalog: InferSchemaInput["snapshot"]["propertyCatalog"],
	minCoverage: number
): SchemaPropertySummary[] {
	const accumulators = new Map<string, PropertyAccumulator>();

	for (const note of notes) {
		for (const [key, value] of Object.entries(note.frontmatter)) {
			const existing = accumulators.get(key) ?? {
				presentIn: 0,
				shapes: [],
				scalarValues: new Set<string>(),
				examples: new Map<string, string>(),
				stringValues: []
			};
			existing.presentIn += 1;

			const shape = detectValueShape(value);
			existing.shapes.push(shape);
			const canonical = canonicalizeValue(value);
			existing.examples.set(canonical, canonical);
			if (typeof value === "string") {
				existing.scalarValues.add(value);
				existing.stringValues.push(value);
			}
			accumulators.set(key, existing);
		}
	}

	const noteCount = notes.length;
	const properties = [...accumulators.entries()]
		.map(([key, accumulator]) => {
			const coverage = noteCount === 0 ? 0 : accumulator.presentIn / noteCount;
			const valueShape = resolveObservedShape(accumulator.shapes);
			const examples = sortStrings(accumulator.examples.keys()).slice(0, 3);
			const formatHint = detectFormatHint(accumulator.stringValues);
			return {
				key,
				obsidianType: propertyCatalog[key]?.obsidianType ?? null,
				valueShape,
				presentIn: accumulator.presentIn,
				noteCount,
				coverage,
				exampleValues: examples,
				enumCandidates: detectEnumCandidates(
					valueShape,
					sortStrings(accumulator.scalarValues),
					coverage
				),
				formatHint,
				warnings: [] as SchemaPropertySummary["warnings"]
			} satisfies SchemaPropertySummary;
		})
		.filter((property) => property.coverage >= minCoverage)
		.sort((left, right) => left.key.localeCompare(right.key));

	const warnings = detectDuplicateWarnings(properties);
	for (const property of properties) {
		property.warnings = warnings.get(property.key) ?? [];
	}

	return properties;
}

export function inferSchema(
	input: InferSchemaInput
): SchemaSummary | GroupedSchemaSummary {
	const minCoverage = (input.minCoverage ?? 10) / 100;

	if (!input.groupBy) {
		return {
			scope: input.scope,
			properties: summarizeProperties(input.snapshot.notes, input.snapshot.propertyCatalog, minCoverage)
		};
	}

	const grouped = buildGroupedNotes(input.snapshot.notes, input.groupBy);
	return {
		scope: input.scope,
		groupBy: {
			kind: input.groupBy.kind,
			key: input.groupBy.kind === "property" ? input.groupBy.key : null,
			mode: grouped.mode,
			unassignedCount: grouped.unassignedCount
		},
		groups: grouped.groups.map((group) => ({
			value: group.value,
			noteCount: group.notes.length,
			properties: summarizeProperties(group.notes, input.snapshot.propertyCatalog, minCoverage)
		}))
	};
}
