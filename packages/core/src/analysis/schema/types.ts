export type SchemaValueShape =
	| "string"
	| "number"
	| "boolean"
	| "string-array"
	| "null"
	| "mixed"
	| "unknown";

export type SchemaPropertyWarning = {
	type: "possible_duplicate_of";
	detail: string;
};

export type SchemaPropertySummary = {
	key: string;
	obsidianType: string | null;
	valueShape: SchemaValueShape;
	presentIn: number;
	noteCount: number;
	coverage: number;
	exampleValues: string[];
	enumCandidates?: string[];
	formatHint?: "date" | "datetime" | "wikilink-list" | null;
	warnings: SchemaPropertyWarning[];
};

export type SchemaScopeSummary = {
	folder: string | null;
	tag: string | null;
	noteCount: number;
};

export type SchemaSummary = {
	scope: SchemaScopeSummary;
	properties: SchemaPropertySummary[];
};

export type SchemaGroupBy =
	| { kind: "folder" }
	| { kind: "tag" }
	| { kind: "property"; key: string };

export type SchemaGroupSummary = {
	value: string;
	noteCount: number;
	properties: SchemaPropertySummary[];
};

export type GroupedSchemaSummary = {
	scope: SchemaScopeSummary;
	groupBy: {
		kind: "folder" | "tag" | "property";
		key: string | null;
		mode: "partition" | "overlap";
		unassignedCount: number;
	};
	groups: SchemaGroupSummary[];
};

export type MissingPropertyResult = {
	scope: SchemaScopeSummary;
	key: string;
	missingCount: number;
	paths: string[];
	property: SchemaPropertySummary | null;
};

export type SchemaValidationIssue = {
	key: string;
	issue: "missing" | "type_mismatch" | "enum_mismatch" | "unusual_key" | "mixed_type";
	severity: "low" | "high";
	coverage?: number;
	expectedObsidianType?: string | null;
	expectedValueShape?: string | null;
	actualValueShape?: string | null;
	note?: string;
};

export type SchemaValidationResult = {
	path: string;
	valid: boolean;
	highestSeverity: "low" | "high" | null;
	issues: SchemaValidationIssue[];
	frontmatter: Record<string, unknown>;
};

export type SchemaValidationBatchResult = {
	scope: SchemaScopeSummary;
	targets: {
		paths: string[];
		noteCount: number;
	};
	failOn: "low" | "high" | "none";
	failed: boolean;
	results: SchemaValidationResult[];
};

export type VaultSchemaNote = {
	path: string;
	folder: string;
	tags: string[];
	frontmatter: Record<string, unknown>;
};

export type VaultSchemaSnapshot = {
	propertyCatalog: Record<string, { obsidianType: string | null }>;
	notes: VaultSchemaNote[];
};

export type InferSchemaInput = {
	snapshot: VaultSchemaSnapshot;
	scope: SchemaScopeSummary;
	minCoverage?: number;
	groupBy?: SchemaGroupBy;
};

export type FindMissingPropertiesInput = {
	snapshot: VaultSchemaSnapshot;
	scope: SchemaScopeSummary;
	key: string;
};

export type ValidateSchemaInput = {
	snapshot: VaultSchemaSnapshot;
	scope: SchemaScopeSummary;
	targets: VaultSchemaNote[];
	missingThreshold?: number;
	failOn?: "low" | "high" | "none";
};
