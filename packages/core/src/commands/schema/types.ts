import type {
	FindMissingPropertiesInput,
	InferSchemaInput,
	ValidateSchemaInput
} from "../../analysis/schema";

export type SchemaOutputFormat = "text" | "json" | "tsv";

export type SchemaInferCommandInput = InferSchemaInput & {
	format?: SchemaOutputFormat;
};

export type SchemaMissingCommandInput = FindMissingPropertiesInput & {
	format?: SchemaOutputFormat;
};

export type SchemaValidateCommandInput = ValidateSchemaInput & {
	format?: "text" | "json";
};
