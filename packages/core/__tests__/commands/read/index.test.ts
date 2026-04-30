import { describe, expect, it } from "vitest";
import { executeReadBulk, formatReadBulkResult, runReadBulkCommand } from "../../../src";

function createNote(
	path: string,
	rawContent: string,
	frontmatter: Record<string, unknown> | null = null
) {
	return {
		path,
		name: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
		tags: [],
		frontmatter,
		rawContent,
		mtimeMs: 0,
		sizeBytes: rawContent.length
	};
}

describe("read bulk command", () => {
	it("builds bundle results and formats markdown/json/tsv", async () => {
		const notes = [
			createNote("notes/a.md", "# A", { status: "todo" }),
			createNote("notes/b.md", "# B")
		];
		const result = await executeReadBulk({
			scope: {
				paths: ["notes/a.md", "notes/b.md"],
				folder: null,
				tag: null,
				sort: "input",
				maxFiles: null,
				maxChars: null,
				includeFrontmatter: true,
				resolveEmbeds: false,
				embedDepth: 3,
				annotateEmbeds: false
			},
			notes,
			relation: "explicit",
			format: "markdown",
			loadNote: async () => null,
			resolveLinkpath: () => null
		});

		expect(result).toMatchObject({ includeFrontmatter: true, truncated: false });
		expect(formatReadBulkResult(result, "markdown")).toContain("## notes/a.md");
		expect(formatReadBulkResult(result, "markdown")).toContain("```yaml");
		expect(JSON.parse(formatReadBulkResult(result, "json"))).toMatchObject({
			truncated: false,
			notes: [{ path: "notes/a.md" }, { path: "notes/b.md" }]
		});
		expect(formatReadBulkResult(result, "tsv")).toContain("path\trelation\ttruncated");
	});

	it("omits frontmatter from json output unless explicitly requested", () => {
		const baseResult = {
			includeFrontmatter: false,
			truncated: false,
			notes: [
				{
					path: "notes/a.md",
					name: "a",
					relation: "explicit" as const,
					frontmatter: { status: "todo" },
					content: "# A",
					truncated: false,
					resolvedEmbeds: []
				}
			]
		};

		expect(JSON.parse(formatReadBulkResult(baseResult, "json"))).toMatchObject({
			notes: [{ frontmatter: null }]
		});
		expect(
			JSON.parse(
				formatReadBulkResult(
					{
						...baseResult,
						includeFrontmatter: true
					},
					"json"
				)
			)
		).toMatchObject({
			notes: [{ frontmatter: { status: "todo" } }]
		});
	});

	it("applies the deterministic token budget", async () => {
		const output = await runReadBulkCommand({
			scope: {
				paths: ["notes/a.md", "notes/b.md"],
				folder: null,
				tag: null,
				sort: "input",
				maxFiles: null,
				maxChars: 8,
				includeFrontmatter: false,
				resolveEmbeds: false,
				embedDepth: 3,
				annotateEmbeds: false
			},
			notes: [
				createNote("notes/a.md", "0123456789ABCDE"),
				createNote("notes/b.md", "second note should be excluded")
			],
			relation: "explicit",
			format: "markdown",
			loadNote: async () => null,
			resolveLinkpath: () => null
		});

		expect(output).toContain("truncated=true");
		expect(output).toContain("## notes/a.md truncated");
		expect(output).not.toContain("notes/b.md");
	});
});
