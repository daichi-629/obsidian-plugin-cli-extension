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
	maxResults?: number;
};

export type SearchOptions = {
	pattern: string;
	pathPrefix?: string;
	fixedStrings: boolean;
	ignoreCase: boolean;
	lineNumber: boolean;
	filesWithMatches: boolean;
	count: boolean;
	maxResults?: number;
};

export type SearchMatch = {
	path: string;
	line?: number;
	text: string;
};

export type SearchResult = {
	matches: SearchMatch[];
	filesScanned: number;
	matchedFiles: number;
	skippedFiles: number;
	stoppedEarly: boolean;
};

export type CompiledSearchPattern = {
	test(input: string): boolean;
};
