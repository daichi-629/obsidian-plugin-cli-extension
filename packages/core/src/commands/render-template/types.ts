export type RenderTemplateMode = "single-file" | "bundle";

export type OverwritePolicy = "fail" | "replace" | "skip";

export type PathConflictPolicy = "fail" | "suffix" | "overwrite";

export type RenderTemplateWriteMode = "apply" | "dry-run";

export type RenderTemplateStdoutMode =
	| "status/text"
	| "status/json"
	| "content/text"
	| "status+content/text"
	| "status+content/json";

export type SourceContext = {
	path: string;
	basename: string;
	frontmatter: Record<string, unknown>;
	body: string;
};

export type TemplateHelpers = {
	slug(value: string): string;
	wikilink(value: string): string;
	lower(value: string): string;
	upper(value: string): string;
	trim(value: string): string;
};

export type TemplatePathHelpers = {
	slug(value: string): string;
	id(prefix?: string): string;
	shortId(): string;
	sequence(): number;
	extname(path: string): string;
	basename(path: string): string;
	dirname(path: string): string;
	join(...parts: string[]): string;
};

export type TemplateSystemContext = {
	nowIso: string;
	date: string;
	time: string;
	timestamp: number;
};

export type TemplateRenderInput = {
	data: Record<string, unknown>;
	source?: SourceContext;
	script: Record<string, unknown>;
	_system: TemplateSystemContext;
	helpers: TemplateHelpers;
	path: TemplatePathHelpers;
};

export type RenderTemplateStaticDataInput = {
	defaults?: Record<string, unknown>;
	defaultData?: Record<string, unknown>[];
	dataFiles?: Record<string, unknown>[];
	inlineData?: Record<string, unknown>;
	set?: Record<string, unknown>[];
};

export type RenderTemplateOptionsInput = {
	template: string;
	mode: RenderTemplateMode;
	destination?: string;
	write?: string;
	stdout?: string;
	existingFile?: string;
	duplicateOutput?: string;
	maxRenderedFiles?: number;
};

export type RenderTemplateOptions = {
	template: string;
	mode: RenderTemplateMode;
	destination?: string;
	write: RenderTemplateWriteMode;
	stdout: RenderTemplateStdoutMode;
	existingFile: OverwritePolicy;
	duplicateOutput: PathConflictPolicy;
	dryRun: boolean;
	maxRenderedFiles?: number;
};

export type TemplateBundleManifestOutput = {
	template: string;
	path: string;
};

export type TemplateBundleManifest = {
	version: 1;
	description?: string;
	partialsDir?: string;
	defaults?: Record<string, unknown>;
	defaultDataFiles: string[];
	outputs: TemplateBundleManifestOutput[];
};

export type ParsedInlineScript = {
	scriptSource?: string;
	templateBody: string;
};

export type RenderTemplateDefinition = {
	templatePath: string;
	templateBody: string;
	outputPathTemplate: string;
	scriptData?: Record<string, unknown>;
};

export type RenderTemplatePlanFile = {
	path: string;
	template: string;
	content: string;
	bytes: number;
};

export type RenderTemplatePlan = {
	template: string;
	mode: RenderTemplateMode;
	dryRun: boolean;
	files: RenderTemplatePlanFile[];
};

export type RenderTemplateResultFile = {
	path: string;
	template: string;
	status: "planned" | "created" | "replaced" | "skipped";
	bytes: number;
};

export type RenderTemplateResult = {
	template: string;
	mode: RenderTemplateMode;
	dryRun: boolean;
	files: RenderTemplateResultFile[];
};
