function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitLines(content: string): string[] {
	return content.split(/\r?\n/);
}

function trimTrailingBlankLines(lines: string[]): string[] {
	const result = [...lines];
	while (result.length > 0 && result[result.length - 1]?.trim() === "") {
		result.pop();
	}
	return result;
}

export function extractHeadingSection(content: string, heading: string): string | null {
	const target = heading.trim();
	if (target.length === 0) {
		return null;
	}

	const lines = splitLines(content);
	let startIndex = -1;
	let headingLevel = 0;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const match = /^(#{1,6})\s+(.*)$/.exec(line);
		if (!match) {
			continue;
		}

		if ((match[2] ?? "").trim() === target) {
			startIndex = index;
			headingLevel = (match[1] ?? "").length;
			break;
		}
	}

	if (startIndex === -1) {
		return null;
	}

	let endIndex = lines.length;
	for (let index = startIndex + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const match = /^(#{1,6})\s+(.*)$/.exec(line);
		if (match && (match[1] ?? "").length <= headingLevel) {
			endIndex = index;
			break;
		}
	}

	return trimTrailingBlankLines(lines.slice(startIndex, endIndex)).join("\n");
}

export function extractBlockSection(content: string, blockId: string): string | null {
	const target = blockId.trim();
	if (target.length === 0) {
		return null;
	}

	const lines = splitLines(content);
	const blockPattern = new RegExp(`\\^${escapeRegExp(target)}(?:\\s*$|\\s+)`);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (!blockPattern.test(line)) {
			continue;
		}

		let startIndex = index;
		while (startIndex > 0) {
			const previous = lines[startIndex - 1] ?? "";
			if (previous.trim() === "" || /^(#{1,6})\s+/.test(previous)) {
				break;
			}
			startIndex -= 1;
		}

		let endIndex = index + 1;
		while (endIndex < lines.length) {
			const current = lines[endIndex] ?? "";
			if (current.trim() === "" || /^(#{1,6})\s+/.test(current)) {
				break;
			}
			endIndex += 1;
		}

		return trimTrailingBlankLines(lines.slice(startIndex, endIndex)).join("\n");
	}

	return null;
}

export function extractMarkdownSection(
	content: string,
	section: { kind: "whole-note" | "heading" | "block"; value: string | null }
): string | null {
	if (section.kind === "whole-note") {
		return content;
	}

	if (section.kind === "heading") {
		return extractHeadingSection(content, section.value ?? "");
	}

	return extractBlockSection(content, section.value ?? "");
}
