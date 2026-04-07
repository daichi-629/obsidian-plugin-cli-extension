export type ApplyPatchInput = {
	patchText: string;
	dryRun: boolean;
	verbose: boolean;
	allowCreate: boolean;
};

export type UpdateChunk = {
	context: string[];
	oldLines: string[];
	newLines: string[];
	isEndOfFile?: boolean;
};

export type ApplyPatchOperation =
	| { type: "add"; path: string; contents: string }
	| { type: "delete"; path: string }
	| {
			type: "update";
			path: string;
			moveTo?: string;
			chunks: UpdateChunk[];
	  };

export type ApplyPatchPlan = {
	operations: ApplyPatchOperation[];
};

export type ApplyPatchExecutionResult = {
	path: string;
	moveTo?: string;
	nextContent: string;
	renamed: boolean;
	changed: boolean;
};

export type ApplyPatchFileResult = {
	path: string;
	nextPath?: string;
	operation: "add" | "delete" | "update" | "move";
	status: "planned" | "applied" | "failed" | "skipped";
	message?: string;
};

export type ApplyPatchResult = {
	files: ApplyPatchFileResult[];
	changedFileCount: number;
	dryRun: boolean;
};
