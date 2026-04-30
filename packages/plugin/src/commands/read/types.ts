import type { ReadBulkOutputFormat } from "@sample/core";

export type ReadBulkCliInput = {
	paths: string[];
	folder?: string;
	tag?: string;
	sort?: "path" | "mtime" | "size";
	maxFiles?: number;
	maxChars?: number;
	includeFrontmatter: boolean;
	resolveEmbeds: boolean;
	embedDepth?: number;
	annotateEmbeds: boolean;
	format: ReadBulkOutputFormat;
};
