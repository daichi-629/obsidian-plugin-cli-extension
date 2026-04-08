function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeValues(left: unknown, right: unknown): unknown {
	if (Array.isArray(right)) {
		return [...right];
	}

	if (isRecord(left) && isRecord(right)) {
		const merged: Record<string, unknown> = { ...left };
		for (const [key, value] of Object.entries(right)) {
			merged[key] = key in merged ? mergeValues(merged[key], value) : mergeValues(undefined, value);
		}

		return merged;
	}

	return right;
}

export function mergeTemplateData(sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
	let merged: Record<string, unknown> = {};
	for (const source of sources) {
		if (!source) {
			continue;
		}

		merged = mergeValues(merged, source) as Record<string, unknown>;
	}

	return merged;
}
