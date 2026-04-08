import { UserError } from "../../shared/errors/userError";
import { detectValueShape } from "./helpers";
import { inferSchema } from "./inferSchema";
import type {
	SchemaPropertySummary,
	SchemaValidationBatchResult,
	SchemaValidationIssue,
	SchemaValidationResult,
	ValidateSchemaInput
} from "./types";

function issueSeverity(
	failOn: "low" | "high" | "none",
	results: SchemaValidationResult[]
): boolean {
	if (failOn === "none") {
		return false;
	}

	return results.some((result) =>
		result.issues.some((issue) => failOn === "low" || issue.severity === "high")
	);
}

function buildIssue(
	key: string,
	issue: SchemaValidationIssue["issue"],
	severity: SchemaValidationIssue["severity"],
	property: SchemaPropertySummary,
	overrides?: Partial<SchemaValidationIssue>
): SchemaValidationIssue {
	return {
		key,
		issue,
		severity,
		coverage: property.coverage,
		expectedObsidianType: property.obsidianType,
		expectedValueShape: property.valueShape,
		...overrides
	};
}

function validateOne(
	noteFrontmatter: Record<string, unknown>,
	property: SchemaPropertySummary,
	missingThreshold: number
): SchemaValidationIssue[] {
	const issues: SchemaValidationIssue[] = [];
	const actual = noteFrontmatter[property.key];
	const hasKey = property.key in noteFrontmatter;

	if (!hasKey && property.coverage >= missingThreshold) {
		issues.push(buildIssue(property.key, "missing", "high", property));
		return issues;
	}

	if (!hasKey) {
		return issues;
	}

	if (property.valueShape === "mixed") {
		issues.push(buildIssue(property.key, "mixed_type", "low", property));
		return issues;
	}

	const actualShape = detectValueShape(actual);
	if (actualShape !== property.valueShape) {
		issues.push(
			buildIssue(property.key, "type_mismatch", "high", property, {
				actualValueShape: actualShape
			})
		);
		return issues;
	}

	if (
		property.enumCandidates &&
		property.enumCandidates.length > 0 &&
		typeof actual === "string" &&
		!property.enumCandidates.includes(actual)
	) {
		issues.push(
			buildIssue(property.key, "enum_mismatch", "high", property, {
				actualValueShape: actualShape
			})
		);
	}

	return issues;
}

export function validateNoteAgainstSchema(
	input: ValidateSchemaInput
): SchemaValidationBatchResult {
	if (input.snapshot.notes.length === 0) {
		throw new UserError("Schema validation requires at least one note in the schema scope.");
	}

	const missingThreshold = (input.missingThreshold ?? 60) / 100;
	const failOn = input.failOn ?? "high";
	const inferred = inferSchema({
		snapshot: input.snapshot,
		scope: input.scope,
		minCoverage: 0
	});
	if (!("properties" in inferred)) {
		throw new UserError("Schema validation requires a non-grouped schema summary.");
	}

	const propertyMap = new Map(inferred.properties.map((property) => [property.key, property]));
	const results = [...input.targets]
		.sort((left, right) => left.path.localeCompare(right.path))
		.map((target) => {
			const issues: SchemaValidationIssue[] = [];
			const candidateKeys = new Set<string>();

			for (const property of inferred.properties) {
				if (property.coverage >= missingThreshold || property.key in target.frontmatter) {
					candidateKeys.add(property.key);
				}
			}

			for (const key of candidateKeys) {
				const property = propertyMap.get(key);
				if (!property) {
					continue;
				}

				issues.push(...validateOne(target.frontmatter, property, missingThreshold));
			}

			for (const [key] of Object.entries(target.frontmatter)) {
				const property = propertyMap.get(key);
				if (property) {
					const duplicateSensitive = property.warnings.some(
						(warning) => warning.type === "possible_duplicate_of"
					);
					const lowCoverage = duplicateSensitive
						? property.coverage < 0.15
						: property.coverage < 0.05 || property.presentIn <= 3;
					if (lowCoverage) {
						issues.push(
							buildIssue(key, "unusual_key", "low", property, {
								note: duplicateSensitive
									? `Possible duplicate of ${property.warnings[0]?.detail ?? "another key"}.`
									: undefined
							})
						);
					}
					continue;
				}

				issues.push({
					key,
					issue: "unusual_key",
					severity: "low",
					note: "Key does not appear in the schema scope."
				});
			}

			issues.sort((left, right) => {
				if (left.severity !== right.severity) {
					return left.severity === "high" ? -1 : 1;
				}

				if (left.key !== right.key) {
					return left.key.localeCompare(right.key);
				}

				return left.issue.localeCompare(right.issue);
			});

			const highestSeverity =
				issues.find((issue) => issue.severity === "high")?.severity ??
				issues.find((issue) => issue.severity === "low")?.severity ??
				null;

			return {
				path: target.path,
				valid: issues.length === 0,
				highestSeverity,
				issues,
				frontmatter: target.frontmatter
			} satisfies SchemaValidationResult;
		});

	return {
		scope: input.scope,
		targets: {
			paths: results.map((result) => result.path),
			noteCount: results.length
		},
		failOn,
		failed: issueSeverity(failOn, results),
		results
	};
}
