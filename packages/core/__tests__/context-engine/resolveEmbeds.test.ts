import { describe, expect, it } from "vitest";
import {
	extractBlockSection,
	extractHeadingSection,
	parseEmbedRefs,
	resolveEmbeds
} from "../../src";

function createNote(path: string, rawContent: string) {
	return {
		path,
		name: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
		tags: [],
		frontmatter: null,
		rawContent,
		mtimeMs: 0,
		sizeBytes: rawContent.length
	};
}

describe("context-engine embed resolution", () => {
	it("parses embed refs and extracts heading/block sections", () => {
		expect(parseEmbedRefs("before ![[notes/a#Section]] and ![[notes/b#^block-1]]")).toEqual([
			expect.objectContaining({
				ref: "notes/a#Section",
				linkpath: "notes/a",
				section: { kind: "heading", value: "Section" }
			}),
			expect.objectContaining({
				ref: "notes/b#^block-1",
				linkpath: "notes/b",
				section: { kind: "block", value: "block-1" }
			})
		]);

		const content = [
			"# One",
			"alpha",
			"",
			"## Two",
			"beta",
			"gamma ^block-1",
			"",
			"# Three"
		].join("\n");
		expect(extractHeadingSection(content, "Two")).toBe("## Two\nbeta\ngamma ^block-1");
		expect(extractBlockSection(content, "block-1")).toBe("beta\ngamma ^block-1");
	});

	it("resolves embeds recursively and records edge cases", async () => {
		const notes = new Map([
			[
				"notes/root.md",
				createNote(
					"notes/root.md",
					[
						"Intro",
						"![[notes/child#Section]]",
						"![[notes/missing]]",
						"![[notes/cycle]]"
					].join("\n")
				)
			],
			[
				"notes/child.md",
				createNote(
					"notes/child.md",
					["# Section", "Child text", "![[notes/grand]]"].join("\n")
				)
			],
			["notes/grand.md", createNote("notes/grand.md", "Grand text")],
			["notes/cycle.md", createNote("notes/cycle.md", "![[notes/root]]")]
		]);

		const result = await resolveEmbeds({
			note: notes.get("notes/root.md")!,
			embedDepth: 3,
			annotateEmbeds: true,
			loadNote: async (path) => notes.get(path) ?? null,
			resolveLinkpath: (linkpath) => {
				if (linkpath === "notes/missing") {
					return null;
				}

				return `${linkpath}.md`;
			}
		});

		expect(result.content).toContain("<!-- embedded-from: notes/child.md#Section -->");
		expect(result.content).toContain("Grand text");
		expect(result.content).toContain("<!-- missing-embed: notes/missing -->");
		expect(result.content).toContain("<!-- circular-embed: notes/root.md -->");
		expect(result.resolvedEmbeds).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ resolvedPath: "notes/child.md", status: "resolved" }),
				expect.objectContaining({ resolvedPath: null, status: "missing" }),
				expect.objectContaining({ resolvedPath: "notes/cycle.md", status: "resolved" }),
				expect.objectContaining({ resolvedPath: "notes/root.md", status: "circular" })
			])
		);
	});

	it("marks remaining embeds as depth-limited at depth 1", async () => {
		const notes = new Map([
			["root.md", createNote("root.md", "![[child]]")],
			["child.md", createNote("child.md", "![[grand]]")],
			["grand.md", createNote("grand.md", "Grand")]
		]);

		const result = await resolveEmbeds({
			note: notes.get("root.md")!,
			embedDepth: 1,
			annotateEmbeds: false,
			loadNote: async (path) => notes.get(path) ?? null,
			resolveLinkpath: (linkpath) => `${linkpath}.md`
		});

		expect(result.content).toBe("![[grand]]");
		expect(result.resolvedEmbeds).toEqual(
			expect.arrayContaining([expect.objectContaining({ status: "depth-limited" })])
		);
	});
});
