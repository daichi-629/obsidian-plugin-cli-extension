import { describe, expect, it } from "vitest";
import { registerRenderTemplateCliHandler } from "../../../src/commands/render-template/registerCliHandler";
import type { TemplateCommandSettings } from "../../../src/settings";

type CapturedHandler = (params: Record<string, string | boolean>) => Promise<string>;
const CONFIG_DIR = "config";

const defaultTemplateSettings: TemplateCommandSettings = {
	templateRoot: "templates/",
	denyOutputPathPrefixes: [],
	maxRenderedFiles: 20
};

function createPlugin(input?: {
	files?: Record<string, string>;
	templateSettings?: TemplateCommandSettings;
}) {
	let capturedHandler: CapturedHandler | undefined;
	const files = new Map(Object.entries(input?.files ?? {}));
	const folders = new Set<string>();

	function ensureParents(filePath: string) {
		const parts = filePath.split("/").slice(0, -1);
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			folders.add(current);
		}
	}

	for (const filePath of files.keys()) {
		ensureParents(filePath);
	}

	const plugin = {
		settings: {
			templateCommandSettings: input?.templateSettings ?? defaultTemplateSettings
		},
		app: {
			vault: {
				configDir: CONFIG_DIR,
				getAbstractFileByPath(filePath: string) {
					if (files.has(filePath)) {
						const fileParts = filePath.split(".");
						return {
							path: filePath,
							extension: fileParts[fileParts.length - 1],
							vault: { configDir: CONFIG_DIR }
						};
					}

					if (folders.has(filePath)) {
						const prefix = `${filePath}/`;
						const children = [
							...files.keys(),
							...folders.values()
						]
							.filter((entry) => entry.startsWith(prefix) && entry !== filePath)
							.filter((entry) => !entry.slice(prefix.length).includes("/"))
							.map((entry) =>
								files.has(entry)
									? (() => {
											const entryParts = entry.split(".");
											return {
												path: entry,
												extension: entryParts[entryParts.length - 1],
												vault: { configDir: CONFIG_DIR }
											};
										})()
									: { path: entry, children: [] }
							);
						return { path: filePath, children };
					}

					return null;
				},
				getFiles() {
					return [...files.keys()].map((filePath) => ({
						path: filePath,
						extension: filePath.split(".")[filePath.split(".").length - 1],
						vault: { configDir: CONFIG_DIR }
					}));
				},
				async cachedRead(file: { path: string }) {
					const result = files.get(file.path);
					if (result === undefined) {
						throw new Error("missing file");
					}

					return result;
				},
				async create(filePath: string, content: string) {
					ensureParents(filePath);
					files.set(filePath, content);
					const fileParts = filePath.split(".");
					return { path: filePath, extension: fileParts[fileParts.length - 1] };
				},
				async modify(file: { path: string }, content: string) {
					files.set(file.path, content);
				},
				async createFolder(folderPath: string) {
					folders.add(folderPath);
				},
				adapter: {
					read: async (filePath: string) => {
						const result = files.get(filePath);
						if (result === undefined) {
							throw new Error("missing file");
						}

						return result;
					}
				}
			}
		},
		registerCliHandler(
			_name: string,
			_summary: string,
			_flags: Record<string, unknown>,
			handler: CapturedHandler
		) {
			capturedHandler = handler;
		}
	};

	registerRenderTemplateCliHandler(plugin as never);
	if (!capturedHandler) {
		throw new Error("handler missing");
	}

	return { handler: capturedHandler, files };
}

describe("registerRenderTemplateCliHandler", () => {
	it("renders a single-file template with content/text in dry-run mode", async () => {
		const { handler } = createPlugin({
			files: {
				"templates/daily-template.md": "# <%= it.data.title %>\n"
			}
		});

		await expect(
			handler({
				template: "daily-template.md",
				destination: "daily/test.md",
				data: '{"title":"Daily"}',
				write: "dry-run",
				stdout: "content/text"
			})
		).resolves.toBe("# Daily\n");
	});

	it("renders a bundle and writes the planned file", async () => {
		const { handler, files } = createPlugin({
			files: {
				"templates/project-scaffold/template.json": JSON.stringify({
					version: 1,
					outputs: [{ template: "README.md", path: "README.md" }]
				}),
				"templates/project-scaffold/README.md": "# <%= it.data.title %>\n"
			}
		});

		await expect(
			handler({
				template: "project-scaffold",
				destination: "projects/atlas",
				data: '{"title":"Atlas"}'
			})
		).resolves.toBe("Rendered 1 file.\n- projects/atlas/README.md (created)");

		expect(files.get("projects/atlas/README.md")).toBe("# Atlas\n");
	});

	it("renders a convention bundle without template.json", async () => {
		const { handler, files } = createPlugin({
			files: {
				"templates/convention/defaults.md": "---\ntitle: Atlas\nstatus: draft\nowners:\n- alice\n---\n",
				"templates/convention/README.md": "---\noutput: projects/<%= it.path.slug(it.data.title) %>/README.md\n---\n# <%= it.data.title %>\nStatus: <%= it.data.status %>\nOwner: <%= it.data.owners[0] %>\n"
			}
		});

		await expect(
			handler({
				template: "convention"
			})
		).resolves.toBe("Rendered 1 file.\n- projects/atlas/README.md (created)");

		expect(files.get("projects/atlas/README.md")).toBe(
			"# Atlas\nStatus: draft\nOwner: alice\n"
		);
	});

	it("handles bundle duplicate-output=suffix", async () => {
		const { handler, files } = createPlugin({
			files: {
				"templates/project-scaffold/template.json": JSON.stringify({
					version: 1,
					outputs: [
						{ template: "README.md", path: "README.md" },
						{ template: "INDEX.md", path: "README.md" }
					],
					defaultDataFiles: []
				}),
				"templates/project-scaffold/README.md": "# One\n",
				"templates/project-scaffold/INDEX.md": "# Two\n"
			}
		});

		await expect(
			handler({
				template: "project-scaffold",
				destination: "projects/atlas",
				"duplicate-output": "suffix"
			})
		).resolves.toBe(
			"Rendered 2 files.\n- projects/atlas/README.md (created)\n- projects/atlas/README-2.md (created)"
		);

		expect(files.get("projects/atlas/README.md")).toBe("# One\n");
		expect(files.get("projects/atlas/README-2.md")).toBe("# Two\n");
	});
});
