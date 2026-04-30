export {
	extractBlockSection,
	extractHeadingSection,
	extractMarkdownSection
} from "./extractMarkdownSection";
export { formatMarkdownBundle } from "./formatMarkdownBundle";
export { parseEmbedRefs } from "./parseEmbedRefs";
export { applyTokenBudget, buildBundleEntryBody, formatFrontmatterBlock } from "./tokenBudget";
export { dedupeInputPaths, sortCatalogNotes, type ContextNoteSort } from "./sortNotes";
export { resolveEmbeds, type ResolveEmbedsInput } from "./resolveEmbeds";
export type {
	BundleEntry,
	ContextNoteCatalogEntry,
	EmbedSection,
	LoadedContextNote,
	ParsedEmbedRef,
	ResolvedEmbedOutput,
	ResolvedEmbedSummary
} from "./types";
