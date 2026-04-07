import { describe, expect, it } from "vitest";
import { buildVaultSource, isVaultSearchTarget } from "../../../src/commands/grep/buildVaultSource";
import type SampleMonorepoPlugin from "../../../src/main";
import type { GrepPermissionSettings } from "../../../src/settings";

const defaultPermissionSettings: GrepPermissionSettings = {
	enabled: true,
	denyPathPrefixes: [".obsidian/", "templates/private/"],
	allowPathPrefixes: [],
	targetExtensions: ["md", "txt"]
};

describe("isVaultSearchTarget", () => {
	it("filters unsupported extensions, config files, and denied paths", () => {
		expect(
			isVaultSearchTarget({
				filePath: ".obsidian/workspace.json",
				extension: "json",
				configDir: ".obsidian",
				pathPrefixes: undefined,
				excludePathPrefixes: undefined,
				targetExtensions: defaultPermissionSettings.targetExtensions,
				permissionSettings: defaultPermissionSettings
			})
		).toBe(false);

		expect(
			isVaultSearchTarget({
				filePath: "templates/private/secret.md",
				extension: "md",
				configDir: ".obsidian",
				pathPrefixes: undefined,
				excludePathPrefixes: undefined,
				targetExtensions: defaultPermissionSettings.targetExtensions,
				permissionSettings: defaultPermissionSettings
			})
		).toBe(false);
	});

	it("applies the requested path prefix after policy filtering", () => {
		expect(
			isVaultSearchTarget({
				filePath: "daily/2026-04-08.md",
				extension: "md",
				configDir: ".obsidian",
				pathPrefixes: ["daily/"],
				excludePathPrefixes: undefined,
				targetExtensions: defaultPermissionSettings.targetExtensions,
				permissionSettings: defaultPermissionSettings
			})
		).toBe(true);

		expect(
			isVaultSearchTarget({
				filePath: "notes/ideas.md",
				extension: "md",
				configDir: ".obsidian",
				pathPrefixes: ["daily/"],
				excludePathPrefixes: undefined,
				targetExtensions: defaultPermissionSettings.targetExtensions,
				permissionSettings: defaultPermissionSettings
			})
		).toBe(false);
	});

	it("supports multiple include prefixes and exclude prefixes", () => {
		expect(
			isVaultSearchTarget({
				filePath: "projects/active.md",
				extension: "md",
				configDir: ".obsidian",
				pathPrefixes: ["projects/", "reference/"],
				excludePathPrefixes: ["projects/archive/"],
				targetExtensions: defaultPermissionSettings.targetExtensions,
				permissionSettings: defaultPermissionSettings
			})
		).toBe(true);

		expect(
			isVaultSearchTarget({
				filePath: "projects/archive/old.md",
				extension: "md",
				configDir: ".obsidian",
				pathPrefixes: ["projects/", "reference/"],
				excludePathPrefixes: ["projects/archive/"],
				targetExtensions: defaultPermissionSettings.targetExtensions,
				permissionSettings: defaultPermissionSettings
			})
		).toBe(false);
	});
});

describe("buildVaultSource", () => {
	it("builds documents only from allowed vault files and tracks skipped reads", async () => {
		const plugin = {
			settings: {
				grepPermissionSettings: defaultPermissionSettings
			},
			app: {
				vault: {
					getFiles() {
						return [
							{
								path: "daily/2026-04-08.md",
								extension: "md",
								vault: { configDir: ".obsidian" }
							},
							{
								path: "templates/private/secret.md",
								extension: "md",
								vault: { configDir: ".obsidian" }
							},
							{
								path: "notes/ideas.txt",
								extension: "txt",
								vault: { configDir: ".obsidian" }
							},
							{
								path: "notes/data.canvas",
								extension: "canvas",
								vault: { configDir: ".obsidian" }
							}
						];
					},
					async cachedRead(file: { path: string }) {
						if (file.path === "notes/ideas.txt") {
							throw new Error("read failed");
						}

						return "TODO ship";
					}
				}
			}
		} as unknown as SampleMonorepoPlugin;

		const source = buildVaultSource(plugin, { pathPrefix: undefined });
		const documents = [];
		for await (const document of source.documents) {
			documents.push(document);
		}

		expect(documents).toEqual([{ path: "daily/2026-04-08.md", content: "TODO ship" }]);
		expect(source.getSkippedCount()).toBe(1);
	});

	it("uses configured target extensions and path filters", async () => {
		const plugin = {
			settings: {
				grepPermissionSettings: {
					...defaultPermissionSettings,
					targetExtensions: ["canvas"]
				}
			},
			app: {
				vault: {
					getFiles() {
						return [
							{
								path: "projects/board.canvas",
								extension: "canvas",
								vault: { configDir: ".obsidian" }
							},
							{
								path: "projects/archive/old.canvas",
								extension: "canvas",
								vault: { configDir: ".obsidian" }
							},
							{
								path: "notes/ideas.md",
								extension: "md",
								vault: { configDir: ".obsidian" }
							}
						];
					},
					async cachedRead() {
						return "TODO ship";
					}
				}
			}
		} as unknown as SampleMonorepoPlugin;

		const source = buildVaultSource(plugin, {
			pathPrefixes: ["projects/"],
			excludePathPrefixes: ["projects/archive/"]
		});
		const documents = [];
		for await (const document of source.documents) {
			documents.push(document);
		}

		expect(documents).toEqual([{ path: "projects/board.canvas", content: "TODO ship" }]);
	});
});
