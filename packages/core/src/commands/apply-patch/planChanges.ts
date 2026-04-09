import { UserError } from "../../shared/errors/userError";
import type { ApplyPatchInput, ApplyPatchPlan } from "./types";

export function planApplyPatchChanges(
	plan: ApplyPatchPlan,
	input: Pick<ApplyPatchInput, "allowCreate" | "dryRun">
): ApplyPatchPlan {
	const seenSourcePaths = new Set<string>();
	const seenDestinationPaths = new Set<string>();

	for (const operation of plan.operations) {
		if (seenSourcePaths.has(operation.path)) {
			throw new UserError(`Patch touches the same file more than once: ${operation.path}`);
		}

		seenSourcePaths.add(operation.path);

		if (operation.type === "add" && !input.allowCreate && !input.dryRun) {
			throw new UserError(
				`Add File is not allowed without --allow-create: ${operation.path}`
			);
		}

		if (operation.type === "update" && operation.moveTo) {
			if (seenDestinationPaths.has(operation.moveTo)) {
				throw new UserError(
					`Patch moves multiple files to the same destination: ${operation.moveTo}`
				);
			}

			seenDestinationPaths.add(operation.moveTo);
		}
	}

	return plan;
}
