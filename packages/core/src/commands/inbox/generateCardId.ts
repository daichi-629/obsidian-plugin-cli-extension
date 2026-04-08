export function generateCardId(now: Date): string {
	const date = now.toISOString().slice(0, 10).replace(/-/g, "");
	const hex = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(2)))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `ibx_${date}_${hex}`;
}
