import type { CliData } from "obsidian";
import type {
	RenderTemplateStdoutMode,
	RenderTemplateWriteMode,
	OverwritePolicy,
	PathConflictPolicy,
	TemplateBundleManifest,
	TemplateSystemContext
} from "@sample/core";

export type RenderTemplateCliInput = {
	template?: string;
	destination?: string;
	write?: RenderTemplateWriteMode;
	stdout?: RenderTemplateStdoutMode;
	existingFile?: OverwritePolicy;
	duplicateOutput?: PathConflictPolicy;
	dataFile?: string[];
	data?: Record<string, unknown>;
	set: Record<string, unknown>[];
};

export type RenderTemplateRawCliData = CliData;

export type ResolvedSingleFileTemplateSource = {
	mode: "single-file";
	templatePath: string;
	templateContent: string;
};

export type ResolvedBundleTemplateSource = {
	mode: "bundle";
	templateRootPath: string;
	manifest: TemplateBundleManifest;
	templateFiles: Record<string, string>;
	partials: Record<string, string>;
};

export type ResolvedTemplateSource =
	| ResolvedSingleFileTemplateSource
	| ResolvedBundleTemplateSource;

export type ResolvedDataSources = {
	defaultData: Record<string, unknown>[];
	dataFiles: Record<string, unknown>[];
	inlineData?: Record<string, unknown>;
	set: Record<string, unknown>[];
};

export type TemplateScriptApi = {
	app: unknown;
	obsidian: unknown;
	input: {
		template: string;
		mode: "single-file" | "bundle";
		destination?: string;
		dryRun: boolean;
	};
	data: Record<string, unknown>;
	system: TemplateSystemContext;
	helpers: {
		slug(value: string): string;
		wikilink(value: string): string;
		lower(value: string): string;
		upper(value: string): string;
		trim(value: string): string;
	};
	path: {
		slug(value: string): string;
		id(prefix?: string): string;
		shortId(): string;
		sequence(): number;
		extname(path: string): string;
		basename(path: string): string;
		dirname(path: string): string;
		join(...parts: string[]): string;
	};
	vault: {
		read(path: string): Promise<string>;
		exists(path: string): Promise<boolean>;
		list(prefix?: string): Promise<string[]>;
	};
};
