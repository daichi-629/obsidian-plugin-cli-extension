export type SearchDocument = {
	path: string;
	content: string;
};

export type SearchInput = {
	pattern?: string;
	pathPrefix?: string;
	fixedStrings?: boolean;
	ignoreCase?: boolean;
	lineNumber?: boolean;
	filesWithMatches?: boolean;
	count?: boolean;
	beforeContext?: number;
	afterContext?: number;
	context?: number;
	maxResults?: number;
	stats?: boolean;
	json?: boolean;
};

export type SearchOptions = {
	pattern: string;
	pathPrefix?: string;
	fixedStrings: boolean;
	ignoreCase: boolean;
	lineNumber: boolean;
	filesWithMatches: boolean;
	count: boolean;
	beforeContext: number;
	afterContext: number;
	maxResults?: number;
	stats: boolean;
	json: boolean;
};

export type SearchMatch = {
	path: string;
	line?: number;
	text: string;
	kind?: "match" | "context";
};

export type SearchResult = {
	matches: SearchMatch[];
	filesScanned: number;
	matchedFiles: number;
	skippedFiles: number;
	stoppedEarly: boolean;
	totalMatches: number;
};

export type CompiledSearchPattern = {
	test(input: string): boolean;
};
