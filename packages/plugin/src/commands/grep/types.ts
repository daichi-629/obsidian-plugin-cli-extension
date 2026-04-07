export type GrepCliInput = {
	pattern?: string;
	pathPrefix?: string;
	pathPrefixes?: string[];
	excludePathPrefixes?: string[];
	fixedStrings: boolean;
	ignoreCase: boolean;
	lineNumber: boolean;
	filesWithMatches: boolean;
	count: boolean;
	beforeContext?: number;
	afterContext?: number;
	context?: number;
	maxResults?: number;
	stats: boolean;
	json: boolean;
};
