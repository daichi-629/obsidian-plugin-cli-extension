export type GraphNode = {
	path: string;
	name: string;
	folder: string;
	tags: string[];
};

export type GraphEdge = {
	from: string;
	to: string;
	linkCount: number;
};

export type GraphSnapshot = {
	nodes: GraphNode[];
	edges: GraphEdge[];
	outgoing: Record<string, GraphEdge[]>;
	incoming: Record<string, GraphEdge[]>;
	meta: {
		noteCount: number;
		edgeCount: number;
	};
};

export type GraphDirection = "out" | "in" | "both";

export type GraphScopeFilter = {
	folder?: string | null;
	tag?: string | null;
};
