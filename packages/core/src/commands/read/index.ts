import { executeReadBulk } from "./execute";
import { formatReadBulkResult } from "./formatResult";
import type { ReadBulkCommandInput } from "./types";

export async function runReadBulkCommand(input: ReadBulkCommandInput): Promise<string> {
	const result = await executeReadBulk(input);
	return formatReadBulkResult(result, input.format ?? "markdown");
}

export { executeReadBulk, formatReadBulkResult };
export type {
	ReadBulkCommandInput,
	ReadBulkOutputFormat,
	ReadBulkResult,
	ReadBulkScope
} from "./types";
