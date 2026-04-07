export type GrepCliInput = {
	pattern?: string;
	pathPrefix?: string;
	fixedStrings: boolean;
	ignoreCase: boolean;
	lineNumber: boolean;
	filesWithMatches: boolean;
	count: boolean;
	maxResults?: number;
};
