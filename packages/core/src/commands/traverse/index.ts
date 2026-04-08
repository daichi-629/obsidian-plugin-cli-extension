import { UserError } from "../../shared/errors/userError";
import { executeTraverseClusters } from "./executeClusters";
import { executeTraversePath } from "./executePath";
import { executeTraverseReach } from "./executeReach";
import { formatTraverseClustersResult } from "./formatClusters";
import { formatTraversePathResult } from "./formatPath";
import { formatTraverseReachResult } from "./formatReach";
import type {
	TraverseClustersCommandInput,
	TraverseClustersResult,
	TraverseOutputFormat,
	TraversePathCommandInput,
	TraversePathResult,
	TraverseReachCommandInput,
	TraverseReachResult
} from "./types";

function assertOutputFormat(format: string | undefined): TraverseOutputFormat {
	const normalized = format ?? "text";
	if (normalized !== "text" && normalized !== "json" && normalized !== "tsv") {
		throw new UserError("The --format option must be text, json, or tsv.");
	}

	return normalized;
}

export function runTraverseReachCommand(input: TraverseReachCommandInput): string {
	const format = assertOutputFormat(input.format);
	return formatTraverseReachResult(executeTraverseReach(input), format);
}

export function runTraversePathCommand(input: TraversePathCommandInput): string {
	const format = assertOutputFormat(input.format);
	return formatTraversePathResult(executeTraversePath(input), format);
}

export function runTraverseClustersCommand(input: TraverseClustersCommandInput): string {
	const format = assertOutputFormat(input.format);
	return formatTraverseClustersResult(executeTraverseClusters(input), format);
}

export {
	executeTraverseClusters,
	executeTraversePath,
	executeTraverseReach,
	formatTraverseClustersResult,
	formatTraversePathResult,
	formatTraverseReachResult
};
export type {
	TraverseClustersCommandInput,
	TraverseClustersResult,
	TraverseOutputFormat,
	TraversePathCommandInput,
	TraversePathResult,
	TraverseReachCommandInput,
	TraverseReachResult
} from "./types";
