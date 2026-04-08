import { UserError } from "@sample/core";
import type { Plugin } from "obsidian";
import type { ResolvedBundleTemplateSource, ResolvedDataSources } from "./types";

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

function getVaultBasePath(plugin: Plugin): string | undefined {
	const adapter = plugin.app.vault.adapter as { getBasePath?: () => string };
	return typeof adapter.getBasePath === "function" ? adapter.getBasePath() : undefined;
}

function isInsideRoot(
	pathModule: NodePathModule,
	candidatePath: string,
	rootPath: string
): boolean {
	return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${pathModule.sep}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonFile(plugin: Plugin, filePath: string): Promise<Record<string, unknown>> {
	let raw: string;
	if (filePath.startsWith("vault:")) {
		const target = plugin.app.vault.getAbstractFileByPath(filePath.slice("vault:".length));
		if (!target || !("extension" in target)) {
			throw new UserError(`Data file "${filePath}" could not be resolved.`);
		}

		raw = await plugin.app.vault.cachedRead(target);
	} else {
		const runtimeRequire = getNodeRequire();
		if (!runtimeRequire) {
			throw new UserError(
				"Filesystem data files require a desktop runtime with Node.js access."
			);
		}

		if (!process || typeof process.cwd !== "function") {
			throw new UserError("Filesystem data files require process.cwd() support.");
		}

		const fs = runtimeRequire("node:fs/promises") as NodeFsModule;
		const pathModule = runtimeRequire("node:path") as NodePathModule;
		const cwd = process.cwd();
		const vaultBasePath = getVaultBasePath(plugin);
		const resolvedPath = pathModule.isAbsolute(filePath)
			? filePath
			: pathModule.resolve(cwd, filePath);
		const isAllowed =
			isInsideRoot(pathModule, resolvedPath, cwd) ||
			(vaultBasePath ? isInsideRoot(pathModule, resolvedPath, vaultBasePath) : false);
		if (!isAllowed) {
			throw new UserError(
				"Absolute --data-file paths must stay inside the current working directory or vault root."
			);
		}

		raw = await fs.readFile(resolvedPath, "utf8");
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new UserError(`Data file "${filePath}" must contain valid JSON.`);
	}

	if (!isRecord(parsed)) {
		throw new UserError(`Data file "${filePath}" must contain a JSON object.`);
	}

	return parsed;
}

export async function resolveDataSources(
	plugin: Plugin,
	input: {
		source: ResolvedBundleTemplateSource | { mode: "single-file" };
		dataFiles?: string[];
		inlineData?: Record<string, unknown>;
		set?: Record<string, unknown>[];
	}
): Promise<ResolvedDataSources> {
	const defaultData: Record<string, unknown>[] = [];
	if (input.source.mode === "bundle") {
		if (input.source.manifest.defaults) {
			defaultData.push(input.source.manifest.defaults);
		}

		for (const file of input.source.manifest.defaultDataFiles) {
			defaultData.push(
				await readJsonFile(plugin, `vault:${input.source.templateRootPath}/${file}`)
			);
		}
	}

	const dataFiles = [];
	for (const file of input.dataFiles ?? []) {
		dataFiles.push(await readJsonFile(plugin, file));
	}

	return {
		defaultData,
		dataFiles,
		inlineData: input.inlineData,
		set: input.set ?? []
	};
}
