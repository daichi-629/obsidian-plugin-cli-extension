import { UserError, compareGraphPaths, type GraphSnapshot } from "@sample/core";

function normalizePathOperand(operand: string): string {
	return operand
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

function stripMdExtension(path: string): string {
	return path.endsWith(".md") ? path.slice(0, -".md".length) : path;
}

function basename(path: string): string {
	const trimmed = stripMdExtension(path);
	const slashIndex = trimmed.lastIndexOf("/");
	return slashIndex === -1 ? trimmed : trimmed.slice(slashIndex + 1);
}

function formatAmbiguousOperand(operand: string, candidates: string[]): never {
	throw new UserError(
		[
			`Ambiguous note operand: "${operand}"`,
			"Candidates:",
			...candidates.map((candidate) => `- ${candidate}`)
		].join("\n")
	);
}

export function resolveGraphOperand(snapshot: GraphSnapshot, operand: string): string {
	const normalized = normalizePathOperand(operand);
	if (normalized.length === 0) {
		throw new UserError("Note operands must not be empty.");
	}

	const exactPath = snapshot.nodes.find((node) => node.path === normalized);
	if (exactPath) {
		return exactPath.path;
	}

	const exactWithoutExtension = normalized.endsWith(".md") ? normalized : `${normalized}.md`;
	const extensionMatch = snapshot.nodes.find((node) => node.path === exactWithoutExtension);
	if (extensionMatch) {
		return extensionMatch.path;
	}

	if (normalized.includes("/")) {
		const linkpathMatches = snapshot.nodes
			.filter((node) => {
				const barePath = stripMdExtension(node.path);
				return barePath === normalized || barePath.endsWith(`/${normalized}`);
			})
			.map((node) => node.path)
			.sort(compareGraphPaths);
		if (linkpathMatches.length === 1) {
			return linkpathMatches[0] ?? "";
		}

		if (linkpathMatches.length > 1) {
			formatAmbiguousOperand(operand, linkpathMatches);
		}
	}

	const basenameMatches = snapshot.nodes
		.filter((node) => basename(node.path) === stripMdExtension(normalized))
		.map((node) => node.path)
		.sort(compareGraphPaths);
	if (basenameMatches.length === 1) {
		return basenameMatches[0] ?? "";
	}

	if (basenameMatches.length > 1) {
		formatAmbiguousOperand(operand, basenameMatches);
	}

	throw new UserError(`Could not resolve note operand: "${operand}"`);
}
