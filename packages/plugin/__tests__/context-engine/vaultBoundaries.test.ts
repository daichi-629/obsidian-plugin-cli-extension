import { describe, expect, it } from "vitest";
import { loadVaultNotes, resolveEmbedTarget } from "../../src/context-engine";

function createPlugin() {
	const files = [
		{
			path: "notes/a.md",
			stat: { mtime: 1, size: 10 }
		},
		{
			path: "config/secret.md",
			stat: { mtime: 1, size: 20 }
		}
	];

	return {
		app: {
			vault: {
				configDir: "config",
				getMarkdownFiles() {
					return files;
				},
				async cachedRead(file: { path: string }) {
					if (file.path === "notes/a.md") {
						return "---\ntags: [project]\n---\nA";
					}

					return "# hidden";
				}
			},
			metadataCache: {
				getFileCache(file: { path: string }) {
					if (file.path === "notes/a.md") {
						return { frontmatter: { tags: ["project"] } };
					}

					return null;
				},
				getFirstLinkpathDest(linkpath: string) {
					if (linkpath === "secret") {
						return { path: "config/secret.md" };
					}

					if (linkpath === "note-a") {
						return { path: "notes/a.md" };
					}

					return null;
				}
			}
		}
	};
}

describe("context-engine vault boundaries", () => {
	it("does not load markdown files from the config directory", async () => {
		await expect(loadVaultNotes(createPlugin() as never, ["config/secret.md"])).rejects.toThrow(
			"The note does not exist in the vault: config/secret.md"
		);

		await expect(
			loadVaultNotes(createPlugin() as never, ["notes/a.md"])
		).resolves.toMatchObject([
			{
				path: "notes/a.md",
				frontmatter: { tags: ["project"] },
				rawContent: "A"
			}
		]);
	});

	it("treats embeds that resolve into the config directory as missing", () => {
		const plugin = createPlugin() as never;
		expect(resolveEmbedTarget(plugin, "secret", "notes/a.md")).toBeNull();
		expect(resolveEmbedTarget(plugin, "note-a", "notes/a.md")).toBe("notes/a.md");
	});
});
