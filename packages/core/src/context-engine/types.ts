export type LoadedContextNote = {
	path: string;
	name: string;
	folder: string;
	tags: string[];
	frontmatter: Record<string, unknown> | null;
	rawContent: string;
	mtimeMs: number;
	sizeBytes: number;
};

export type ContextNoteCatalogEntry = {
	path: string;
	name: string;
	folder: string;
	tags: string[];
	mtimeMs: number;
	sizeBytes: number;
};

export type EmbedSection = {
	kind: "whole-note" | "heading" | "block";
	value: string | null;
};

export type ResolvedEmbedSummary = {
	ref: string;
	resolvedPath: string | null;
	section: EmbedSection;
	status: "resolved" | "missing" | "circular" | "depth-limited";
};

export type BundleEntry = {
	path: string;
	name: string;
	relation: "explicit" | "scoped";
	frontmatter: Record<string, unknown> | null;
	content: string;
	truncated: boolean;
	resolvedEmbeds: ResolvedEmbedSummary[];
};

export type ParsedEmbedRef = {
	raw: string;
	ref: string;
	linkpath: string;
	section: EmbedSection;
	index: number;
	length: number;
};

export type ResolvedEmbedOutput = {
	content: string;
	resolvedEmbeds: ResolvedEmbedSummary[];
};
