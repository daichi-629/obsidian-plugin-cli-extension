import { UserError } from "../../shared/errors/userError";
import { normalizeLineEndings } from "../../shared/text/normalizeLineEndings";
import type { ApplyPatchExecutionResult, UpdateChunk } from "./types";

function matchesAt(lines: string[], candidate: string[], startIndex: number): boolean {
	if (startIndex + candidate.length > lines.length) {
		return false;
	}

	for (let index = 0; index < candidate.length; index += 1) {
		if (lines[startIndex + index] !== candidate[index]) {
			return false;
		}
	}

	return true;
}

function anchorsMatch(lines: string[], anchors: string[], beforeIndex: number): boolean {
	let searchStart = 0;

	for (const anchor of anchors) {
		let matched = false;
		for (let index = searchStart; index < lines.length && index <= beforeIndex; index += 1) {
			if (lines[index] === anchor) {
				searchStart = index + 1;
				matched = true;
				break;
			}
		}

		if (!matched) {
			return false;
		}
	}

	return true;
}

function describeChunk(chunk: UpdateChunk): string {
	const anchor = chunk.context.find((value) => value.length > 0);
	if (anchor) {
		return `@@ ${anchor}`;
	}

	const line = chunk.oldLines[0] ?? chunk.newLines[0];
	return line ? `line '${line}'` : "the requested location";
}

function findChunkStart(lines: string[], chunk: UpdateChunk): number {
	const matchIndexes: number[] = [];
	const maxStart = lines.length - chunk.oldLines.length;

	for (let index = 0; index <= maxStart; index += 1) {
		if (chunk.isEndOfFile && index + chunk.oldLines.length !== lines.length) {
			continue;
		}

		if (!matchesAt(lines, chunk.oldLines, index)) {
			continue;
		}

		if (!anchorsMatch(lines, chunk.context, index)) {
			continue;
		}

		matchIndexes.push(index);
	}

	if (matchIndexes.length === 1) {
		return matchIndexes[0];
	}

	if (matchIndexes.length === 0) {
		throw new UserError(`Context not found at ${describeChunk(chunk)}.`);
	}

	throw new UserError(`Patch context is ambiguous at ${describeChunk(chunk)}.`);
}

function splitLines(content: string): string[] {
	if (content.length === 0) {
		return [];
	}

	return content.split("\n");
}

export function executeApplyPatchUpdate(input: {
	path: string;
	moveTo?: string;
	chunks: UpdateChunk[];
	currentContent: string;
}): ApplyPatchExecutionResult {
	const normalizedContent = normalizeLineEndings(input.currentContent);
	let lines = splitLines(normalizedContent);

	for (const chunk of input.chunks) {
		const startIndex = findChunkStart(lines, chunk);
		lines = [
			...lines.slice(0, startIndex),
			...chunk.newLines,
			...lines.slice(startIndex + chunk.oldLines.length)
		];
	}

	const nextContent = lines.join("\n");

	return {
		path: input.path,
		moveTo: input.moveTo,
		nextContent,
		renamed: input.moveTo !== undefined && input.moveTo !== input.path,
		changed: nextContent !== normalizedContent
	};
}
