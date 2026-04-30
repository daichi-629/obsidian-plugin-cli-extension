import type { ContextNoteSort, LoadedContextNote, BundleEntry } from "../../context-engine";

export type ReadBulkOutputFormat = "markdown" | "json" | "tsv";

export type ReadBulkScope = {
	paths: string[] | null;
	folder: string | null;
	tag: string | null;
	sort: "input" | ContextNoteSort;
	maxFiles: number | null;
	maxChars: number | null;
	includeFrontmatter: boolean;
	resolveEmbeds: boolean;
	embedDepth: number;
	annotateEmbeds: boolean;
};

export type ReadBulkCommandInput = {
	scope: ReadBulkScope;
	notes: LoadedContextNote[];
	relation: BundleEntry["relation"];
	format?: ReadBulkOutputFormat;
	loadNote(path: string): Promise<LoadedContextNote | null>;
	resolveLinkpath(linkpath: string, sourcePath: string): string | null;
};

export type ReadBulkResult = {
	includeFrontmatter: boolean;
	truncated: boolean;
	notes: BundleEntry[];
};
