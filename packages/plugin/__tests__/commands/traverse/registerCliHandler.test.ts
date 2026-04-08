import { describe, expect, it } from "vitest";
import { registerTraverseCliHandlers } from "../../../src/commands/traverse/registerCliHandler";

type CapturedHandler = (params: Record<string, string | boolean>) => Promise<string> | string;

function createPlugin() {
	const handlers = new Map<string, CapturedHandler>();

	const plugin = {
		app: {
			vault: {
				configDir: "config",
				getMarkdownFiles() {
					return [
						{ path: "projects/a.md" },
						{ path: "projects/b.md" },
						{ path: "reference/c.md" },
						{ path: "solo/d.md" },
						{ path: "config/ignore.md" }
					];
				}
			},
			metadataCache: {
				getFileCache(file: { path: string }) {
					const tags: Record<string, Array<{ tag: string }>> = {
						"projects/a.md": [{ tag: "#project" }],
						"projects/b.md": [{ tag: "#project" }],
						"reference/c.md": [{ tag: "#reference" }]
					};
					return tags[file.path] ? { tags: tags[file.path] } : null;
				},
				resolvedLinks: {
					"projects/a.md": { "projects/b.md": 1 },
					"projects/b.md": { "reference/c.md": 1 }
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

	registerTraverseCliHandlers(plugin as never);
	return handlers;
}

describe("registerTraverseCliHandlers", () => {
	it("registers reach, path, and clusters handlers", () => {
		const handlers = createPlugin();
		expect([...handlers.keys()].sort()).toEqual([
			"excli-traverse:clusters",
			"excli-traverse:path",
			"excli-traverse:reach"
		]);
	});

	it("runs reach and path handlers", async () => {
		const handlers = createPlugin();
		const reachOutput = await handlers.get("excli-traverse:reach")!({
			from: "projects/a",
			depth: "2",
			format: "json"
		});
		expect(JSON.parse(reachOutput)).toMatchObject({
			mode: "reach",
			result: { noteCount: 3, edgeCount: 2 }
		});

		const pathOutput = await handlers.get("excli-traverse:path")!({
			from: "projects/a",
			to: "reference/c",
			format: "json"
		});
		expect(JSON.parse(pathOutput)).toMatchObject({
			mode: "path",
			found: true,
			hops: 2
		});
	});

	it("returns cluster summaries and manual output", async () => {
		const handlers = createPlugin();
		expect(await handlers.get("excli-traverse:clusters")!({ "min-size": "2" })).toContain(
			"Components (min-size >= 2): 1"
		);
		expect(await handlers.get("excli-traverse:path")!({ man: true })).toContain(
			"NAME\n  excli-traverse:path - Return the deterministic shortest path between two notes."
		);
	});
});
