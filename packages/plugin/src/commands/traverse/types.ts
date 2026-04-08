import type { GraphDirection } from "@sample/core";

export type TraverseReachCliInput = {
	from: string;
	depth?: number;
	direction: GraphDirection;
	folder?: string;
	tag?: string;
	format: "text" | "json" | "tsv";
};

export type TraversePathCliInput = {
	from: string;
	to: string;
	direction: "out" | "both";
	folder?: string;
	tag?: string;
	format: "text" | "json" | "tsv";
};

export type TraverseClustersCliInput = {
	folder?: string;
	tag?: string;
	minSize?: number;
	format: "text" | "json" | "tsv";
};
