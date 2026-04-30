import type { BundleEntry } from "./types";

export type BundleBudgetOptions = {
	maxChars?: number | null;
	includeFrontmatter: boolean;
};

function isPrimitive(value: unknown): value is string | number | boolean | null {
	return (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	);
}

function formatYamlScalar(value: string | number | boolean | null): string {
	if (value === null) {
		return "null";
	}

	if (typeof value === "string") {
		if (value === "" || /[:#\-\[\]\{\}\n\r\t]/.test(value)) {
			return JSON.stringify(value);
		}
		return value;
	}

	return String(value);
}

export function formatFrontmatterBlock(frontmatter: Record<string, unknown> | null): string {
	if (!frontmatter || Object.keys(frontmatter).length === 0) {
		return "";
	}

	const lines = ["```yaml"];
	for (const [key, rawValue] of Object.entries(frontmatter)) {
		if (Array.isArray(rawValue)) {
			lines.push(`${key}:`);
			for (const item of rawValue) {
				lines.push(
					`- ${isPrimitive(item) ? formatYamlScalar(item) : JSON.stringify(item)}`
				);
			}
			continue;
		}

		lines.push(
			`${key}: ${isPrimitive(rawValue) ? formatYamlScalar(rawValue) : JSON.stringify(rawValue)}`
		);
	}
	lines.push("```");
	return lines.join("\n");
}

export function buildBundleEntryBody(
	entry: Pick<BundleEntry, "content" | "frontmatter">,
	options: { includeFrontmatter: boolean }
): string {
	const parts: string[] = [];
	if (options.includeFrontmatter) {
		const frontmatterBlock = formatFrontmatterBlock(entry.frontmatter);
		if (frontmatterBlock.length > 0) {
			parts.push(frontmatterBlock);
		}
	}
	parts.push(entry.content);
	return parts.filter((part) => part.length > 0).join("\n\n");
}

export function applyTokenBudget(
	entries: BundleEntry[],
	options: BundleBudgetOptions
): { entries: BundleEntry[]; truncated: boolean } {
	if (!options.maxChars || options.maxChars < 1) {
		return { entries, truncated: false };
	}

	let remainingChars = options.maxChars;
	let truncated = false;
	const accepted: BundleEntry[] = [];

	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index]!;
		const body = buildBundleEntryBody(entry, {
			includeFrontmatter: options.includeFrontmatter
		});
		const bodyChars = body.length;
		if (bodyChars <= remainingChars) {
			accepted.push(entry);
			remainingChars -= bodyChars;
			continue;
		}

		truncated = true;
		if (index > 0) {
			break;
		}

		const frontmatterBlock = options.includeFrontmatter
			? formatFrontmatterBlock(entry.frontmatter)
			: "";
		const prefix = frontmatterBlock.length > 0 ? `${frontmatterBlock}\n\n` : "";
		const availableContentChars = Math.max(remainingChars - prefix.length, 0);
		const truncatedContent = entry.content.slice(0, availableContentChars);
		accepted.push({
			...entry,
			content: truncatedContent,
			truncated: true
		});
		break;
	}

	return { entries: accepted, truncated };
}
