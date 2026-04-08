import { inferSchema } from "./inferSchema";
import type { FindMissingPropertiesInput, MissingPropertyResult } from "./types";

export function findMissingProperties(
	input: FindMissingPropertiesInput
): MissingPropertyResult {
	const paths = input.snapshot.notes
		.filter((note) => !(input.key in note.frontmatter))
		.map((note) => note.path)
		.sort((left, right) => left.localeCompare(right));
	const summary = inferSchema({
		snapshot: input.snapshot,
		scope: input.scope,
		minCoverage: 0
	});

	return {
		scope: input.scope,
		key: input.key,
		missingCount: paths.length,
		paths,
		property:
			"properties" in summary
				? summary.properties.find((property) => property.key === input.key) ?? null
				: null
	};
}
