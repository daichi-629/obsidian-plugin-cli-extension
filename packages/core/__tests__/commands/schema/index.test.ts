import { describe, expect, it } from "vitest";
import {
	findMissingProperties,
	inferSchema,
	runSchemaInferCommand,
	runSchemaMissingCommand,
	runSchemaValidateCommand,
	validateNoteAgainstSchema,
	type VaultSchemaSnapshot
} from "../../../src";

function createSnapshot(): VaultSchemaSnapshot {
	return {
		propertyCatalog: {
			status: { obsidianType: "text" },
			tags: { obsidianType: "tags" },
			created: { obsidianType: "date" }
		},
		notes: [
			{
				path: "projects/a.md",
				folder: "projects",
				tags: ["project", "alpha"],
				frontmatter: {
					status: "todo",
					tags: ["project"],
					created: "2026-04-01",
					type: "project"
				}
			},
			{
				path: "projects/b.md",
				folder: "projects",
				tags: ["project"],
				frontmatter: {
					status: "done",
					tags: ["project"],
					type: "project"
				}
			},
			{
				path: "inbox/c.md",
				folder: "inbox",
				tags: ["idea"],
				frontmatter: {
					status: "todo",
					type: "idea",
					rogue_key: true
				}
			}
		]
	};
}

describe("schema analysis", () => {
	it("infers deterministic property summaries and grouped schema", () => {
		const snapshot = createSnapshot();
		const summary = inferSchema({
			snapshot,
			scope: { folder: null, tag: null, noteCount: snapshot.notes.length },
			minCoverage: 10
		});

		expect("properties" in summary && summary.properties).toEqual([
			expect.objectContaining({
				key: "created",
				valueShape: "string",
				formatHint: "date",
				coverage: 1 / 3
			}),
			expect.objectContaining({
				key: "rogue_key",
				valueShape: "boolean",
				coverage: 1 / 3
			}),
			expect.objectContaining({
				key: "status",
				valueShape: "string",
				enumCandidates: ["done", "todo"]
			}),
			expect.objectContaining({
				key: "tags",
				obsidianType: "tags",
				valueShape: "string-array"
			}),
			expect.objectContaining({
				key: "type",
				enumCandidates: ["idea", "project"]
			})
		]);

		const grouped = inferSchema({
			snapshot,
			scope: { folder: null, tag: null, noteCount: snapshot.notes.length },
			groupBy: { kind: "property", key: "type" },
			minCoverage: 0
		});

		expect(grouped).toMatchObject({
			groupBy: {
				kind: "property",
				key: "type",
				mode: "partition",
				unassignedCount: 0
			},
			groups: [
				{ value: "idea", noteCount: 1 },
				{ value: "project", noteCount: 2 }
			]
		});
	});

	it("finds missing properties and validates target notes", () => {
		const snapshot = createSnapshot();
		const missing = findMissingProperties({
			snapshot,
			scope: { folder: null, tag: null, noteCount: snapshot.notes.length },
			key: "created"
		});
		expect(missing.paths).toEqual(["inbox/c.md", "projects/b.md"]);

		const validation = validateNoteAgainstSchema({
			snapshot: {
				propertyCatalog: snapshot.propertyCatalog,
				notes: snapshot.notes.filter((note) => note.path !== "inbox/c.md")
			},
			scope: { folder: null, tag: null, noteCount: 2 },
			targets: [snapshot.notes[2]!],
			missingThreshold: 50,
			failOn: "high"
		});

		expect(validation.failed).toBe(true);
		expect(validation.results[0]).toMatchObject({
			path: "inbox/c.md",
			valid: false,
			highestSeverity: "high"
		});
		expect(validation.results[0]?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "created", issue: "missing", severity: "high" }),
				expect.objectContaining({ key: "rogue_key", issue: "unusual_key", severity: "low" })
			])
		);
	});

	it("formats infer, missing, and validate outputs", () => {
		const snapshot = createSnapshot();
		const scope = { folder: null, tag: null, noteCount: snapshot.notes.length };

		expect(
			runSchemaInferCommand({
				snapshot,
				scope,
				format: "tsv",
				minCoverage: 0
			})
		).toContain("key\tobsidian_type\tvalue_shape");

		expect(
			runSchemaMissingCommand({
				snapshot,
				scope,
				key: "created",
				format: "tsv"
			})
		).toBe("inbox/c.md\nprojects/b.md");

		const text = runSchemaValidateCommand({
			snapshot: {
				propertyCatalog: snapshot.propertyCatalog,
				notes: snapshot.notes.filter((note) => note.path !== "inbox/c.md")
			},
			scope: { folder: null, tag: null, noteCount: 2 },
			targets: [snapshot.notes[2]!],
			format: "text"
		});

		expect(text).toContain("Schema validation for 1 notes: fail");
	});
});
