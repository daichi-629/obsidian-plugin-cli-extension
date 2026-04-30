import { buildBundleEntryBody } from "./tokenBudget";
import type { BundleEntry } from "./types";

export function formatMarkdownBundle(input: {
	entries: BundleEntry[];
	includeFrontmatter: boolean;
	truncated: boolean;
}): string {
	const sections = [`<!-- excli-read:bulk truncated=${String(input.truncated)} -->`];

	for (const entry of input.entries) {
		const suffix = entry.truncated ? " truncated" : "";
		sections.push(`## ${entry.path}${suffix}`);
		const body = buildBundleEntryBody(entry, {
			includeFrontmatter: input.includeFrontmatter
		});
		if (body.length > 0) {
			sections.push(body);
		}
	}

	return sections.join("\n\n");
}
