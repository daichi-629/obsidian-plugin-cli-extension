export type SchemaCliFormat = "text" | "json" | "tsv";

export type SchemaInferCliInput = {
	folder?: string;
	tag?: string;
	groupBy?: string;
	minCoverage?: number;
	format: SchemaCliFormat;
};

export type SchemaMissingCliInput = {
	folder?: string;
	tag?: string;
	key: string;
	format: SchemaCliFormat;
};

export type SchemaValidateCliInput = {
	folder?: string;
	tag?: string;
	paths: string[];
	missingThreshold?: number;
	failOn?: "low" | "high" | "none";
	format: "text" | "json";
};
