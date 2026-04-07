import { describe, expect, it } from "vitest";
import { registerGrepCliHandler } from "../../../src/commands/grep/registerCliHandler";
import type { GrepPermissionSettings } from "../../../src/settings";

const defaultPermissionSettings: GrepPermissionSettings = {
	enabled: true,
	denyPathPrefixes: [".obsidian/", "templates/private/"],
	allowPathPrefixes: [],
	targetExtensions: ["md", "txt"]
};

type CapturedHandler = (params: Record<string, string | boolean>) => Promise<string>;

function createPlugin(input?: {
	permissionSettings?: GrepPermissionSettings;
	files?: Array<{ path: string; extension: string; content?: string; readFails?: boolean }>;
}): {
	handler: CapturedHandler;
} {
	let capturedHandler: CapturedHandler | undefined;
	const files =
		input?.files?.map((file) => ({
			path: file.path,
			extension: file.extension,
			content: file.content ?? "",
			readFails: file.readFails ?? false,
			vault: { configDir: ".obsidian" }
		})) ?? [];

	const plugin = {
		settings: {
			grepPermissionSettings: input?.permissionSettings ?? defaultPermissionSettings
		},
		app: {
			vault: {
				getFiles() {
					return files;
				},
				async cachedRead(file: { path: string }) {
					const target = files.find((entry) => entry.path === file.path);
					if (!target || target.readFails) {
						throw new Error("read failed");
					}

					return target.content;
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

	registerGrepCliHandler(plugin as never);

	if (!capturedHandler) {
		throw new Error("CLI handler was not registered.");
	}

	return {
		handler: capturedHandler
	};
}

describe("registerGrepCliHandler", () => {
	it("returns a policy error for denied paths before searching", async () => {
		const { handler } = createPlugin();

		await expect(handler({ pattern: "TODO", path: "templates/private/" })).resolves.toBe(
			'Access to path "templates/private/" is denied by grep policy.'
		);
	});

	it("returns a policy error when any included path is denied", async () => {
		const { handler } = createPlugin();

		await expect(
			handler({ pattern: "TODO", path: "projects/,templates/private/" })
		).resolves.toBe('Access to path "templates/private/" is denied by grep policy.');
	});

	it("appends a skipped-file warning in plain-text mode", async () => {
		const { handler } = createPlugin({
			files: [
				{
					path: "daily/2026-04-08.md",
					extension: "md",
					content: "TODO ship"
				},
				{
					path: "notes/broken.txt",
					extension: "txt",
					readFails: true
				}
			]
		});

		await expect(handler({ pattern: "TODO" })).resolves.toBe(
			"daily/2026-04-08.md:TODO ship\n(1 file skipped due to read error)"
		);
	});

	it("keeps json output parseable when files are skipped", async () => {
		const { handler } = createPlugin({
			files: [
				{
					path: "daily/2026-04-08.md",
					extension: "md",
					content: "TODO ship"
				},
				{
					path: "notes/broken.txt",
					extension: "txt",
					readFails: true
				}
			]
		});

		const output = await handler({ pattern: "TODO", json: true });
		expect(JSON.parse(output)).toMatchObject({
			skippedFiles: 1,
			totalMatches: 1,
			matches: [{ path: "daily/2026-04-08.md", text: "TODO ship", kind: "match" }]
		});
	});
});
