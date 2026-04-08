import { UserError } from "../../shared/errors/userError";
import {
	findMissingProperties,
	inferSchema,
	validateNoteAgainstSchema
} from "../../analysis/schema";
import { formatInferResult } from "./formatInfer";
import { formatMissingResult } from "./formatMissing";
import { formatValidateResult } from "./formatValidate";
import type {
	SchemaInferCommandInput,
	SchemaMissingCommandInput,
	SchemaValidateCommandInput
} from "./types";

export function runSchemaInferCommand(input: SchemaInferCommandInput): string {
	const format = input.format ?? "text";
	if (format !== "text" && format !== "json" && format !== "tsv") {
		throw new UserError("The --format option must be text, json, or tsv.");
	}

	return formatInferResult(inferSchema(input), format);
}

export function runSchemaMissingCommand(input: SchemaMissingCommandInput): string {
	const format = input.format ?? "text";
	if (format !== "text" && format !== "json" && format !== "tsv") {
		throw new UserError("The --format option must be text, json, or tsv.");
	}

	return formatMissingResult(findMissingProperties(input), format);
}

export function runSchemaValidateCommand(input: SchemaValidateCommandInput): string {
	const format = input.format ?? "text";
	if (format !== "text" && format !== "json") {
		throw new UserError("The --format option must be text or json.");
	}

	return formatValidateResult(validateNoteAgainstSchema(input), format);
}

export type {
	SchemaInferCommandInput,
	SchemaMissingCommandInput,
	SchemaOutputFormat,
	SchemaValidateCommandInput
} from "./types";
