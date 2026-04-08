export function generateFingerprint(source: string, title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "");
	return `${source}:${slug}`;
}
