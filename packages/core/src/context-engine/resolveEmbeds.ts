import { extractMarkdownSection } from "./extractMarkdownSection";
import { parseEmbedRefs } from "./parseEmbedRefs";
import type {
	EmbedSection,
	LoadedContextNote,
	ResolvedEmbedOutput,
	ResolvedEmbedSummary
} from "./types";

export type ResolveEmbedsInput = {
	note: LoadedContextNote;
	embedDepth: number;
	annotateEmbeds: boolean;
	loadNote(path: string): Promise<LoadedContextNote | null>;
	resolveLinkpath(linkpath: string, sourcePath: string): string | null;
};

function buildAnnotation(path: string, section: EmbedSection): string {
	if (section.kind === "whole-note") {
		return `<!-- embedded-from: ${path} -->`;
	}

	if (section.kind === "block") {
		return `<!-- embedded-from: ${path}#^${section.value ?? ""} -->`;
	}

	return `<!-- embedded-from: ${path}#${section.value ?? ""} -->`;
}

async function resolveOne(
	content: string,
	input: ResolveEmbedsInput,
	remainingDepth: number,
	stack: string[]
): Promise<ResolvedEmbedOutput> {
	if (remainingDepth < 1) {
		return {
			content,
			resolvedEmbeds: parseEmbedRefs(content).map((ref) => ({
				ref: ref.ref,
				resolvedPath: input.resolveLinkpath(ref.linkpath, input.note.path),
				section: ref.section,
				status: "depth-limited"
			}))
		};
	}

	const refs = parseEmbedRefs(content);
	if (refs.length === 0) {
		return {
			content,
			resolvedEmbeds: []
		};
	}

	let cursor = 0;
	let output = "";
	const resolvedEmbeds: ResolvedEmbedSummary[] = [];

	for (const ref of refs) {
		output += content.slice(cursor, ref.index);
		cursor = ref.index + ref.length;

		const resolvedPath = input.resolveLinkpath(ref.linkpath, input.note.path);
		if (!resolvedPath) {
			resolvedEmbeds.push({
				ref: ref.ref,
				resolvedPath: null,
				section: ref.section,
				status: "missing"
			});
			output += `<!-- missing-embed: ${ref.linkpath} -->`;
			continue;
		}

		if (stack.includes(resolvedPath)) {
			resolvedEmbeds.push({
				ref: ref.ref,
				resolvedPath,
				section: ref.section,
				status: "circular"
			});
			output += `<!-- circular-embed: ${resolvedPath} -->`;
			continue;
		}

		const target = await input.loadNote(resolvedPath);
		const sectionContent = target && extractMarkdownSection(target.rawContent, ref.section);
		if (!target || sectionContent === null) {
			resolvedEmbeds.push({
				ref: ref.ref,
				resolvedPath,
				section: ref.section,
				status: "missing"
			});
			output += `<!-- missing-embed: ${resolvedPath} -->`;
			continue;
		}

		const nested = await resolveOne(
			sectionContent,
			{
				...input,
				note: target
			},
			remainingDepth - 1,
			[...stack, resolvedPath]
		);
		resolvedEmbeds.push({
			ref: ref.ref,
			resolvedPath,
			section: ref.section,
			status: "resolved"
		});
		resolvedEmbeds.push(...nested.resolvedEmbeds);

		if (input.annotateEmbeds) {
			output += `${buildAnnotation(resolvedPath, ref.section)}\n`;
		}
		output += nested.content;
	}

	output += content.slice(cursor);
	return {
		content: output,
		resolvedEmbeds
	};
}

export async function resolveEmbeds(input: ResolveEmbedsInput): Promise<ResolvedEmbedOutput> {
	if (input.embedDepth === 0) {
		return {
			content: input.note.rawContent,
			resolvedEmbeds: []
		};
	}

	return resolveOne(input.note.rawContent, input, input.embedDepth, [input.note.path]);
}
