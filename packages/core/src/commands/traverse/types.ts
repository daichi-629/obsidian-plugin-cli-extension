import type { GraphDirection, GraphSnapshot } from "../../graph";

export type TraverseOutputFormat = "text" | "json" | "tsv";

export type TraverseReachCommandInput = {
	snapshot: GraphSnapshot;
	from: string;
	depth?: number;
	direction?: GraphDirection;
	folder?: string | null;
	tag?: string | null;
	format?: TraverseOutputFormat;
};

export type TraversePathCommandInput = {
	snapshot: GraphSnapshot;
	from: string;
	to: string;
	direction?: "out" | "both";
	folder?: string | null;
	tag?: string | null;
	format?: TraverseOutputFormat;
};

export type TraverseClustersCommandInput = {
	snapshot: GraphSnapshot;
	folder?: string | null;
	tag?: string | null;
	minSize?: number;
	format?: TraverseOutputFormat;
};

export type TraverseReachResult = {
	mode: "reach";
	scope: {
		from: string;
		folder: string | null;
		tag: string | null;
		direction: GraphDirection;
		depth: number;
		noteCount: number;
		edgeCount: number;
	};
	result: {
		noteCount: number;
		edgeCount: number;
	};
	nodes: Array<{
		path: string;
		name: string;
		hops: number;
	}>;
	edges: Array<{
		from: string;
		to: string;
		linkCount: number;
	}>;
};

export type TraversePathFoundResult = {
	mode: "path";
	found: true;
	scope: {
		from: string;
		to: string;
		folder: string | null;
		tag: string | null;
		direction: "out" | "both";
		noteCount: number;
		edgeCount: number;
	};
	hops: number;
	nodes: Array<{
		index: number;
		path: string;
		name: string;
	}>;
	edges: Array<{
		from: string;
		to: string;
		linkCount: number;
	}>;
};

export type TraversePathResult =
	| TraversePathFoundResult
	| {
			mode: "path";
			found: false;
			scope: {
				from: string;
				to: string;
				folder: string | null;
				tag: string | null;
				direction: "out" | "both";
				noteCount: number;
				edgeCount: number;
			};
	  };

export type TraverseClustersResult = {
	mode: "clusters";
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
		edgeCount: number;
		componentCount: number;
		displayedComponentCount: number;
		minSize: number;
	};
	clusters: Array<{
		index: number;
		size: number;
		paths: string[];
	}>;
};
