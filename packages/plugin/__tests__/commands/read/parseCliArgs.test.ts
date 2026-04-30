import { describe, expect, it } from "vitest";
import { parseReadBulkCliArgs } from "../../../src/commands/read/parseCliArgs";

describe("read bulk cli parsing", () => {
	it("parses explicit paths from path/paths selectors", () => {
		expect(
			parseReadBulkCliArgs({
				path: ["notes/a.md"],
				paths: "notes/b.md, notes/c.md",
				"max-files": "2",
				"max-char": "100",
				"include-frontmatter": true,
				"resolve-embeds": true,
				"embed-depth": "4",
				"annotate-embeds": true,
				format: "json"
			} as never)
		).toEqual({
			ok: true,
			value: {
				paths: ["notes/a.md", "notes/b.md", "notes/c.md"],
				folder: undefined,
				tag: undefined,
				sort: undefined,
				maxFiles: 2,
				maxChars: 100,
				includeFrontmatter: true,
				resolveEmbeds: true,
				embedDepth: 4,
				annotateEmbeds: true,
				format: "json"
			}
		});

		expect(parseReadBulkCliArgs({ path: '["HOME.md","notes/b.md"]' })).toEqual({
			ok: true,
			value: {
				paths: ["HOME.md", "notes/b.md"],
				folder: undefined,
				tag: undefined,
				sort: undefined,
				maxFiles: undefined,
				maxChars: undefined,
				includeFrontmatter: false,
				resolveEmbeds: false,
				embedDepth: undefined,
				annotateEmbeds: false,
				format: "markdown"
			}
		});

		expect(parseReadBulkCliArgs({ paths: '["HOME.md","notes/c.md"]' })).toEqual({
			ok: true,
			value: {
				paths: ["HOME.md", "notes/c.md"],
				folder: undefined,
				tag: undefined,
				sort: undefined,
				maxFiles: undefined,
				maxChars: undefined,
				includeFrontmatter: false,
				resolveEmbeds: false,
				embedDepth: undefined,
				annotateEmbeds: false,
				format: "markdown"
			}
		});
	});

	it("validates selector and embed option rules", () => {
		expect(parseReadBulkCliArgs({ folder: "notes", sort: "recent" })).toEqual({
			ok: false,
			message: "The --sort option must be path, mtime, or size."
		});
		expect(parseReadBulkCliArgs({ path: "notes/a.md", folder: "notes" })).toEqual({
			ok: false,
			message:
				"The bulk command accepts either path selectors or folder/tag selectors, not both."
		});
		expect(parseReadBulkCliArgs({ "embed-depth": "2" })).toEqual({
			ok: false,
			message:
				"The bulk command requires at least one path=<path>, paths=<path[,path...]>, folder=<path>, or tag=<tag>."
		});
		expect(parseReadBulkCliArgs({ folder: "notes", "annotate-embeds": true })).toEqual({
			ok: false,
			message: "The --embed-depth and --annotate-embeds options require --resolve-embeds."
		});
		expect(parseReadBulkCliArgs({ tag: "#" })).toEqual({
			ok: false,
			message: "The --tag option must not be empty."
		});
		expect(parseReadBulkCliArgs({ folder: " / " })).toEqual({
			ok: false,
			message: "The --folder option must not be empty."
		});
	});

	it("rejects malformed integer options", () => {
		expect(parseReadBulkCliArgs({ path: "notes/a.md", "max-files": "1.5" })).toEqual({
			ok: false,
			message: "The --max-files option must be a positive integer."
		});
		expect(parseReadBulkCliArgs({ path: "notes/a.md", "max-char": "10abc" })).toEqual({
			ok: false,
			message: "The --max-char option must be a positive integer."
		});
		expect(
			parseReadBulkCliArgs({
				path: "notes/a.md",
				"resolve-embeds": true,
				"embed-depth": "2x"
			})
		).toEqual({
			ok: false,
			message: "The --embed-depth option must be a non-negative integer."
		});
		expect(parseReadBulkCliArgs({ paths: "[1,2]" })).toEqual({
			ok: false,
			message:
				"The --paths option must be a comma-separated string or a JSON array of string paths."
		});
	});
});
