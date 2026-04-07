import { UserError } from "../../shared/errors/userError";
import { normalizeLineEndings } from "../../shared/text/normalizeLineEndings";
import type { ApplyPatchOperation, ApplyPatchPlan, UpdateChunk } from "./types";

const BEGIN_PATCH = "*** Begin Patch";
const END_PATCH = "*** End Patch";
const ADD_FILE = "*** Add File: ";
const DELETE_FILE = "*** Delete File: ";
const UPDATE_FILE = "*** Update File: ";
const MOVE_TO = "*** Move to: ";
const END_OF_FILE = "*** End of File";

function readPath(line: string, prefix: string): string {
	const path = line.slice(prefix.length).trim();
	if (path.length === 0) {
		throw new UserError(`Missing path in patch header: ${line}`);
	}

	return path;
}

function isHeader(line: string): boolean {
	return (
		line.startsWith(ADD_FILE) ||
		line.startsWith(DELETE_FILE) ||
		line.startsWith(UPDATE_FILE)
	);
}

function finalizeChunk(
	chunks: UpdateChunk[],
	chunk: UpdateChunk | null
): void {
	if (!chunk) {
		return;
	}

	if (
		chunk.context.length === 0 &&
		chunk.oldLines.length === 0 &&
		chunk.newLines.length === 0 &&
		!chunk.isEndOfFile
	) {
		return;
	}

	chunks.push(chunk);
}

function parseUpdateChunks(lines: string[], startIndex: number): {
	chunks: UpdateChunk[];
	nextIndex: number;
} {
	const chunks: UpdateChunk[] = [];
	let index = startIndex;
	let currentChunk: UpdateChunk | null = null;

	while (index < lines.length) {
		const line = lines[index];
		if (line === END_PATCH || isHeader(line)) {
			break;
		}

		if (line.startsWith("@@")) {
			const contextLine = line === "@@" ? "" : line.slice(3);
			if (
				currentChunk &&
				(currentChunk.oldLines.length > 0 ||
					currentChunk.newLines.length > 0 ||
					currentChunk.isEndOfFile)
			) {
				finalizeChunk(chunks, currentChunk);
				currentChunk = null;
			}

			currentChunk ??= {
				context: [],
				oldLines: [],
				newLines: []
			};
			currentChunk.context.push(contextLine);
			index += 1;
			continue;
		}

		if (line === END_OF_FILE) {
			currentChunk ??= {
				context: [],
				oldLines: [],
				newLines: []
			};
			currentChunk.isEndOfFile = true;
			index += 1;
			continue;
		}

		const marker = line[0];
		if (![" ", "+", "-"].includes(marker)) {
			throw new UserError(`Unsupported patch line: ${line}`);
		}

		currentChunk ??= {
			context: [],
			oldLines: [],
			newLines: []
		};

		const value = line.slice(1);
		if (marker === " ") {
			currentChunk.oldLines.push(value);
			currentChunk.newLines.push(value);
		} else if (marker === "-") {
			currentChunk.oldLines.push(value);
		} else {
			currentChunk.newLines.push(value);
		}

		index += 1;
	}

	finalizeChunk(chunks, currentChunk);
	return { chunks, nextIndex: index };
}

function parseAddOperation(lines: string[], startIndex: number): {
	operation: ApplyPatchOperation;
	nextIndex: number;
} {
	const path = readPath(lines[startIndex], ADD_FILE);
	const contentLines: string[] = [];
	let index = startIndex + 1;

	while (index < lines.length) {
		const line = lines[index];
		if (line === END_PATCH || isHeader(line)) {
			break;
		}

		if (!line.startsWith("+")) {
			throw new UserError(`Add File blocks only support '+' lines: ${line}`);
		}

		contentLines.push(line.slice(1));
		index += 1;
	}

	if (contentLines.length === 0) {
		throw new UserError(`Add File requires at least one content line: ${path}`);
	}

	return {
		operation: {
			type: "add",
			path,
			contents: contentLines.join("\n")
		},
		nextIndex: index
	};
}

function parseDeleteOperation(lines: string[], startIndex: number): {
	operation: ApplyPatchOperation;
	nextIndex: number;
} {
	return {
		operation: {
			type: "delete",
			path: readPath(lines[startIndex], DELETE_FILE)
		},
		nextIndex: startIndex + 1
	};
}

function parseUpdateOperation(lines: string[], startIndex: number): {
	operation: ApplyPatchOperation;
	nextIndex: number;
} {
	const path = readPath(lines[startIndex], UPDATE_FILE);
	let index = startIndex + 1;
	let moveTo: string | undefined;

	if (index < lines.length && lines[index].startsWith(MOVE_TO)) {
		moveTo = readPath(lines[index], MOVE_TO);
		index += 1;
	}

	const { chunks, nextIndex } = parseUpdateChunks(lines, index);
	if (chunks.length === 0 && !moveTo) {
		throw new UserError(`Update File requires at least one change: ${path}`);
	}

	return {
		operation: {
			type: "update",
			path,
			moveTo,
			chunks
		},
		nextIndex
	};
}

export function parseApplyPatch(patchText: string): ApplyPatchPlan {
	const normalizedPatchText = normalizeLineEndings(patchText).trim();
	const lines = normalizedPatchText.split("\n");

	if (lines[0] !== BEGIN_PATCH) {
		throw new UserError("Patch must start with '*** Begin Patch'.");
	}

	if (lines[lines.length - 1] !== END_PATCH) {
		throw new UserError("Patch must end with '*** End Patch'.");
	}

	const operations: ApplyPatchOperation[] = [];
	let index = 1;

	while (index < lines.length - 1) {
		const line = lines[index];
		if (line.startsWith(ADD_FILE)) {
			const parsed = parseAddOperation(lines, index);
			operations.push(parsed.operation);
			index = parsed.nextIndex;
			continue;
		}

		if (line.startsWith(DELETE_FILE)) {
			const parsed = parseDeleteOperation(lines, index);
			operations.push(parsed.operation);
			index = parsed.nextIndex;
			continue;
		}

		if (line.startsWith(UPDATE_FILE)) {
			const parsed = parseUpdateOperation(lines, index);
			operations.push(parsed.operation);
			index = parsed.nextIndex;
			continue;
		}

		throw new UserError(`Unexpected patch header: ${line}`);
	}

	if (operations.length === 0) {
		throw new UserError("Patch must include at least one file operation.");
	}

	return { operations };
}
