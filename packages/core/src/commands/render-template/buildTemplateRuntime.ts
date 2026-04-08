import type {
	SourceContext,
	TemplateHelpers,
	TemplatePathHelpers,
	TemplateRenderInput,
	TemplateSystemContext
} from "./types";

function slugify(value: string): string {
	const normalized = value
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, " ")
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return normalized.length > 0 ? normalized : "untitled";
}

function randomBase36(size: number): string {
	let output = "";
	while (output.length < size) {
		output += Math.random().toString(36).slice(2);
	}

	return output.slice(0, size);
}

function normalizePath(filePath: string): string {
	return filePath.replace(/\\/g, "/");
}

function basename(filePath: string): string {
	const normalized = normalizePath(filePath);
	const segments = normalized.split("/").filter((entry) => entry.length > 0);
	return segments.length > 0 ? segments[segments.length - 1] : "";
}

function dirname(filePath: string): string {
	const normalized = normalizePath(filePath);
	const segments = normalized.split("/").filter((entry) => entry.length > 0);
	if (segments.length <= 1) {
		return ".";
	}

	return segments.slice(0, -1).join("/");
}

function extname(filePath: string): string {
	const name = basename(filePath);
	const index = name.lastIndexOf(".");
	return index <= 0 ? "" : name.slice(index);
}

function joinPaths(...parts: string[]): string {
	const segments = parts.flatMap((part) =>
		normalizePath(part)
			.split("/")
			.filter((entry) => entry.length > 0 && entry !== ".")
	);
	return segments.join("/");
}

export function createTemplateSystemContext(now = new Date()): TemplateSystemContext {
	const nowIso = now.toISOString();
	return {
		nowIso,
		date: nowIso.slice(0, 10),
		time: nowIso.slice(11, 19),
		timestamp: now.getTime()
	};
}

export function createTemplateHelpers(): TemplateHelpers {
	return {
		slug(value: string) {
			return slugify(value);
		},
		wikilink(value: string) {
			return `[[${value.trim()}]]`;
		},
		lower(value: string) {
			return value.toLowerCase();
		},
		upper(value: string) {
			return value.toUpperCase();
		},
		trim(value: string) {
			return value.trim();
		}
	};
}

export function createTemplatePathHelpers(system: TemplateSystemContext): TemplatePathHelpers {
	let sequence = 0;
	return {
		slug(value: string) {
			return slugify(value);
		},
		id(prefix?: string) {
			const stem = `${system.timestamp}-${randomBase36(8)}`;
			return prefix ? `${slugify(prefix)}-${stem}` : stem;
		},
		shortId() {
			return randomBase36(6);
		},
		sequence() {
			sequence += 1;
			return sequence;
		},
		extname(filePath: string) {
			return extname(filePath);
		},
		basename(filePath: string) {
			return basename(filePath);
		},
		dirname(filePath: string) {
			return dirname(filePath);
		},
		join(...parts: string[]) {
			return joinPaths(...parts);
		}
	};
}

export function buildTemplateRuntime(input: {
	data: Record<string, unknown>;
	source?: SourceContext;
	script?: Record<string, unknown>;
	system?: TemplateSystemContext;
}): TemplateRenderInput {
	const system = input.system ?? createTemplateSystemContext();
	return {
		data: input.data,
		source: input.source,
		script: input.script ?? {},
		_system: system,
		helpers: createTemplateHelpers(),
		path: createTemplatePathHelpers(system)
	};
}
