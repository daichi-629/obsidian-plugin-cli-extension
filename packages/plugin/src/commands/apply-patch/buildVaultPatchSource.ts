import { UserError } from "@sample/core";
import type { Plugin } from "obsidian";

declare const require: ((specifier: string) => unknown) | undefined;
declare const process: { cwd(): string } | undefined;

type NodeFsModule = {
	readFile(path: string, encoding: string): Promise<string>;
};

type NodePathModule = {
	isAbsolute(path: string): boolean;
	resolve(...paths: string[]): string;
	sep: string;
};

function getNodeRequire(): ((specifier: string) => unknown) | undefined {
	return typeof require === "function" ? require : undefined;
}

function isInsideRoot(
	pathModule: NodePathModule,
	candidatePath: string,
	rootPath: string
): boolean {
	return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${pathModule.sep}`);
}

function getVaultBasePath(plugin: Plugin): string | undefined {
	const adapter = plugin.app.vault.adapter as { getBasePath?: () => string };
	if (typeof adapter.getBasePath === "function") {
		return adapter.getBasePath();
	}

	return undefined;
}

function validateVaultPatchFilePath(path: string): string {
	const normalized = path
		.replace(/^vault:/, "")
		.replace(/^\/+/, "")
		.replace(/\\/g, "/");
	if (normalized.length === 0) {
		throw new UserError("The --patch-file vault path must not be empty.");
	}

	const segments = normalized.split("/");
	if (
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		segments.some((segment) => segment === "." || segment === ".." || segment.length === 0)
	) {
		throw new UserError(`Invalid vault patch file path: ${path}`);
	}

	return normalized;
}

export async function buildVaultPatchSource(
	plugin: Plugin,
	input: { patch?: string; patchFile?: string }
): Promise<string> {
	if (input.patch !== undefined) {
		return input.patch;
	}

	if (!input.patchFile) {
		throw new UserError("Specify exactly one of --patch or --patch-file.");
	}

	if (input.patchFile.startsWith("vault:")) {
		const vaultPath = validateVaultPatchFilePath(input.patchFile);
		const content = await plugin.app.vault.adapter.read(vaultPath);
		return content;
	}

	const runtimeRequire = getNodeRequire();
	if (!runtimeRequire) {
		throw new UserError(
			"Filesystem patch files require a desktop runtime with Node.js access."
		);
	}

	if (!process || typeof process.cwd !== "function") {
		throw new UserError("Filesystem patch files require process.cwd() support.");
	}

	const fs = runtimeRequire("node:fs/promises") as NodeFsModule;
	const pathModule = runtimeRequire("node:path") as NodePathModule;
	const cwd = process.cwd();
	const vaultBasePath = getVaultBasePath(plugin);

	const resolvedPath = pathModule.isAbsolute(input.patchFile)
		? input.patchFile
		: pathModule.resolve(cwd, input.patchFile);

	const isAllowed =
		isInsideRoot(pathModule, resolvedPath, cwd) ||
		(vaultBasePath ? isInsideRoot(pathModule, resolvedPath, vaultBasePath) : false);

	if (!isAllowed) {
		throw new UserError(
			"Absolute --patch-file paths must stay inside the current working directory or vault root."
		);
	}

	return fs.readFile(resolvedPath, "utf8");
}
