import { describe, expect, it } from "vitest";
import { registerSchemaCliHandlers } from "../../../src/commands/schema/registerCliHandler";

type CapturedHandler = (params: Record<string, string | boolean | string[]>) => Promise<string>;

function createPlugin() {
	const handlers = new Map<string, CapturedHandler>();
	const files = [
		{ path: "projects/a.md", extension: "md" },
		{ path: "projects/b.md", extension: "md" },
		{ path: "inbox/c.md", extension: "md" },
		{ path: ".obsidian/config.md", extension: "md" }
	];
	const caches: Record<string, { frontmatter?: Record<string, unknown>; tags?: Array<{ tag: string }> }> = {
		"projects/a.md": {
			frontmatter: { status: "todo", tags: ["project"], type: "project" },
			tags: [{ tag: "#project" }]
		},
		"projects/b.md": {
			frontmatter: { status: "done", type: "project" },
			tags: [{ tag: "#project" }]
		},
		"inbox/c.md": {
			frontmatter: { status: 1, rogue_key: true },
			tags: [{ tag: "#idea" }]
		}
	};

	const plugin = {
		app: {
			vault: {
				configDir: ".obsidian",
				getMarkdownFiles() {
					return files;
				}
			},
			metadataCache: {
				getFileCache(file: { path: string }) {
					return caches[file.path] ?? null;
				},
				getAllPropertyInfos() {
					return {
						status: { type: "text" },
						tags: { type: "tags" }
					};
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

	registerSchemaCliHandlers(plugin as never);
	return handlers;
}

describe("registerSchemaCliHandlers", () => {
	it("registers infer, missing, and validate handlers", () => {
		const handlers = createPlugin();
		expect([...handlers.keys()].sort()).toEqual([
			"excli-schema:infer",
			"excli-schema:missing",
			"excli-schema:validate"
		]);
	});

	it("runs schema inference against filtered vault notes", async () => {
		const handlers = createPlugin();
		const output = await handlers.get("excli-schema:infer")!({
			tag: "project",
			format: "json"
		});
		expect(JSON.parse(output)).toMatchObject({
			scope: { tag: "project", noteCount: 2 }
		});
	});

	it("excludes target notes from the validation schema scope", async () => {
		const handlers = createPlugin();
		const output = await handlers.get("excli-schema:validate")!({
			path: ["inbox/c.md"],
			format: "json"
		});
		expect(JSON.parse(output)).toMatchObject({
			scope: { noteCount: 2 },
			results: [
				{
					path: "inbox/c.md",
					valid: false
				}
			]
		});
	});
});
