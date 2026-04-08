import { Eta } from "eta/core";
import { UserError } from "../../shared/errors/userError";
import { validateRenderedPaths } from "./validateRenderedPaths";
import type {
	RenderTemplateDefinition,
	RenderTemplatePlan,
	TemplateRenderInput
} from "./types";

function normalizePath(filePath: string): string {
	return filePath.replace(/\\/g, "/");
}

function joinPaths(...parts: string[]): string {
	const segments = parts.flatMap((part) =>
		normalizePath(part)
			.split("/")
			.filter((entry) => entry.length > 0 && entry !== ".")
	);
	return segments.join("/");
}

function dirname(filePath: string): string {
	const normalized = normalizePath(filePath);
	const segments = normalized.split("/").filter((entry) => entry.length > 0);
	if (segments.length <= 1) {
		return "";
	}

	return segments.slice(0, -1).join("/");
}

function basename(filePath: string): string {
	const normalized = normalizePath(filePath);
	const segments = normalized.split("/").filter((entry) => entry.length > 0);
	return segments.length > 0 ? segments[segments.length - 1] : "";
}

function normalizePartialSpecifier(specifier: string): string {
	return specifier.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function buildPartialAliases(filePath: string): string[] {
	const aliases = new Set<string>([filePath]);
	const filename = basename(filePath);
	const extensionIndex = filename.lastIndexOf(".");
	if (extensionIndex > 0) {
		const dir = dirname(filePath);
		const stem = filename.slice(0, extensionIndex);
		aliases.add(dir ? joinPaths(dir, stem) : stem);
	}

	return [...aliases];
}

function createEta(partialsByAlias: Map<string, string>): Eta {
	const eta = new Eta({
		cache: false,
		autoTrim: false
	});

	eta.resolvePath = function (template) {
		return normalizePartialSpecifier(template);
	};

	eta.readFile = function (filePath) {
		const partial = partialsByAlias.get(filePath);
		if (partial === undefined) {
			throw new UserError(`Template partial "${filePath}" could not be resolved.`);
		}

		return partial;
	};

	return eta;
}

function renderWithEta(
	eta: Eta,
	template: string,
	runtime: TemplateRenderInput,
	filePath: string
): string {
	try {
		const compiled = eta.compile(template, { filepath: filePath });
		return eta.render(compiled, runtime, { filepath: filePath });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown template error";
		throw new UserError(`Template render failed for "${filePath}": ${message}`);
	}
}

export function renderTemplateBundle(input: {
	template: string;
	mode: RenderTemplatePlan["mode"];
	dryRun: boolean;
	definitions: RenderTemplateDefinition[];
	runtimeFactory: (definition: RenderTemplateDefinition) => TemplateRenderInput;
	partials?: Record<string, string>;
	outputRoot?: string;
}): RenderTemplatePlan {
	const partialsByAlias = new Map<string, string>();
	for (const [filePath, contents] of Object.entries(input.partials ?? {})) {
		for (const alias of buildPartialAliases(filePath)) {
			partialsByAlias.set(alias, contents);
		}
	}
	const eta = createEta(partialsByAlias);

	const files = input.definitions.map((definition) => {
		const runtime = input.runtimeFactory(definition);
		const relativePath = renderWithEta(
			eta,
			definition.outputPathTemplate,
			runtime,
			`${definition.templatePath}#path`
		);
		const fullPath = input.outputRoot
			? joinPaths(input.outputRoot, relativePath)
			: relativePath;
		const content = renderWithEta(eta, definition.templateBody, runtime, definition.templatePath);

		return {
			path: fullPath,
			template: definition.templatePath,
			content,
			bytes: new TextEncoder().encode(content).length
		};
	});

	const normalizedPaths = validateRenderedPaths(files.map((file) => file.path));
	return {
		template: input.template,
		mode: input.mode,
		dryRun: input.dryRun,
		files: files.map((file, index) => ({
			...file,
			path: normalizedPaths[index]
		}))
	};
}
