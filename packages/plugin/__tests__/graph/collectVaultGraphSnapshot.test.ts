import { describe, expect, it } from "vitest";
import { collectVaultGraphSnapshot } from "../../src/graph/collectVaultGraphSnapshot";

describe("collectVaultGraphSnapshot", () => {
	it("collects markdown nodes, tags, and collapsed edges from metadata", () => {
		const snapshot = collectVaultGraphSnapshot({
			app: {
				vault: {
					configDir: "config",
					getMarkdownFiles() {
						return [
							{ path: "notes/a.md" },
							{ path: "notes/b.md" },
							{ path: "assets/canvas.md" },
							{ path: "config/ignore.md" }
						];
					}
				},
				metadataCache: {
					getFileCache(file: { path: string }) {
						if (file.path === "notes/a.md") {
							return { tags: [{ tag: "#project" }] };
						}

						if (file.path === "notes/b.md") {
							return { frontmatter: { tags: ["idea"] } };
						}

						return null;
					},
					resolvedLinks: {
						"notes/a.md": {
							"notes/b.md": 2,
							"attachments/file.pdf": 1
						},
						"notes/b.md": {
							"notes/a.md": 1,
							"notes/b.md": 4
						},
						"config/ignore.md": {
							"notes/a.md": 1
						}
					}
				}
			}
		} as never);

		expect(snapshot.nodes).toEqual([
			{ path: "assets/canvas.md", name: "canvas", folder: "assets", tags: [] },
			{ path: "notes/a.md", name: "a", folder: "notes", tags: ["project"] },
			{ path: "notes/b.md", name: "b", folder: "notes", tags: ["idea"] }
		]);
		expect(snapshot.edges).toEqual([
			{ from: "notes/a.md", to: "notes/b.md", linkCount: 2 },
			{ from: "notes/b.md", to: "notes/a.md", linkCount: 1 }
		]);
	});

	it("falls back to cached outgoing links when resolvedLinks are missing", () => {
		const snapshot = collectVaultGraphSnapshot({
			app: {
				vault: {
					configDir: "config",
					getMarkdownFiles() {
						return [{ path: "notes/a.md" }, { path: "notes/b.md" }, { path: "notes/c.md" }];
					}
				},
				metadataCache: {
					getFileCache(file: { path: string }) {
						if (file.path === "notes/a.md") {
							return {
								links: [{ link: "notes/b" }, { link: "notes/c" }],
								embeds: [{ link: "notes/c" }]
							};
						}

						return { links: [] };
					},
					getFirstLinkpathDest(linkpath: string) {
						const table: Record<string, { path: string } | null> = {
							"notes/b": { path: "notes/b.md" },
							"notes/c": { path: "notes/c.md" }
						};
						return table[linkpath] ?? null;
					},
					resolvedLinks: {
						"notes/b.md": {
							"notes/a.md": 1
						}
					}
				}
			}
		} as never);

		expect(snapshot.edges).toEqual([
			{ from: "notes/a.md", to: "notes/b.md", linkCount: 1 },
			{ from: "notes/a.md", to: "notes/c.md", linkCount: 2 },
			{ from: "notes/b.md", to: "notes/a.md", linkCount: 1 }
		]);
	});
});
