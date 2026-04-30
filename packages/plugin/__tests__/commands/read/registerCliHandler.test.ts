import { describe, expect, it } from "vitest";
import { registerReadBulkCliHandler } from "../../../src/commands/read/registerCliHandler";

type CapturedHandler = (
	params: Record<string, string | boolean | string[]>
) => Promise<string> | string;

function createPlugin() {
	const handlers = new Map<string, CapturedHandler>();
	const files = [
		{
			path: "notes/a.md",
			stat: { mtime: 20, size: 40 }
		},
		{
			path: "notes/b.md",
			stat: { mtime: 10, size: 20 }
		},
		{
			path: "notes/c.md",
			stat: { mtime: 30, size: 80 }
		},
		{
			path: "config/ignore.md",
			stat: { mtime: 1, size: 1 }
		}
	];
	const contents: Record<string, string> = {
		"notes/a.md": ["---", "status: todo", "---", "A", "![[notes/b#Section]]"].join("\n"),
		"notes/b.md": ["# Section", "B", "", "# Tail"].join("\n"),
		"notes/c.md": "C"
	};

	const plugin = {
		app: {
			vault: {
				configDir: "config",
				getMarkdownFiles() {
					return files;
				},
				async cachedRead(file: { path: string }) {
					return contents[file.path] ?? "";
				}
			},
			metadataCache: {
				getFileCache(file: { path: string }) {
					const caches: Record<string, Record<string, unknown>> = {
						"notes/a.md": {
							tags: [{ tag: "#project" }],
							frontmatter: { status: "todo" },
							embeds: [{ link: "notes/b#Section" }]
						},
						"notes/b.md": {
							tags: [{ tag: "#project" }]
						},
						"notes/c.md": {
							tags: [{ tag: "#reference" }]
						}
					};
					return caches[file.path] ?? null;
				},
				getFirstLinkpathDest(linkpath: string) {
					if (linkpath === "notes/b") {
						return { path: "notes/b.md" };
					}

					return null;
				}
			}
		},
		registerCliHandler(
			name: string,
			_summary: string,
			_flags: Record<string, unknown>,
			handler: CapturedHandler
		) {
			handlers.set(name, handler);
		}
	};

	registerReadBulkCliHandler(plugin as never);
	return handlers;
}

describe("registerReadBulkCliHandler", () => {
	it("registers the bulk read handler and supports manual output", async () => {
		const handlers = createPlugin();
		expect([...handlers.keys()]).toEqual(["excli-read:bulk"]);
		expect(await handlers.get("excli-read:bulk")!({ man: true })).toContain(
			"NAME\n  excli-read:bulk - Read multiple markdown notes in one deterministic bundle."
		);
	});

	it("runs explicit and scoped selections", async () => {
		const handlers = createPlugin();
		const explicit = await handlers.get("excli-read:bulk")!({
			paths: "notes/a.md,notes/a.md,notes/b.md",
			"include-frontmatter": true,
			"resolve-embeds": true,
			format: "json"
		});
		expect(JSON.parse(explicit)).toMatchObject({
			truncated: false,
			notes: [
				{
					path: "notes/a.md",
					relation: "explicit",
					frontmatter: { status: "todo" },
					truncated: false
				},
				{
					path: "notes/b.md",
					relation: "explicit",
					truncated: false
				}
			]
		});

		const scoped = await handlers.get("excli-read:bulk")!({
			tag: "project",
			sort: "mtime",
			format: "tsv"
		});
		expect(scoped).toContain("notes/a.md");
		expect(scoped).toContain("notes/b.md");
	});

	it("returns validation and missing-path failures as user-facing messages", async () => {
		const handlers = createPlugin();
		expect(await handlers.get("excli-read:bulk")!({ path: "notes/missing.md" })).toBe(
			"The note does not exist in the vault: notes/missing.md"
		);
		expect(await handlers.get("excli-read:bulk")!({ folder: "" })).toBe(
			"The --folder option must not be empty."
		);
		expect(await handlers.get("excli-read:bulk")!({ path: "notes/a.md", sort: "path" })).toBe(
			"The --sort option is only valid for folder/tag selection."
		);
	});

	it("applies max-files before validating explicit path existence", async () => {
		const handlers = createPlugin();
		const output = await handlers.get("excli-read:bulk")!({
			paths: "notes/a.md,notes/missing.md",
			"max-files": "1",
			format: "json"
		});

		expect(JSON.parse(output)).toMatchObject({
			truncated: false,
			notes: [{ path: "notes/a.md", truncated: false }]
		});
	});
});
