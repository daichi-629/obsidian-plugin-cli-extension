import {
	buildTemplateRuntime,
	createTemplateSystemContext,
	formatRenderTemplateResult,
	mergeTemplateData,
	parseInlineTemplateScript,
	parseRenderTemplateOptions,
	renderTemplateBundle,
	UserError
} from "@sample/core";
import type { CliHandler, Plugin } from "obsidian";
import {
	buildCliFlags,
	isManualRequest,
	renderCommandReference
} from "../../shared/cli/commandReference";
import { buildObsidianTemplateApi } from "./buildObsidianTemplateApi";
import { applyRenderPlan } from "./applyRenderPlan";
import { parseRenderTemplateCliArgs } from "./parseCliArgs";
import { resolveDataSources } from "./resolveDataSources";
import { resolveTemplateSource } from "./resolveTemplateSource";
import { runInlineTemplateScript } from "./runInlineScript";
import { renderTemplateCommandSpec } from "./spec";
import type { ResolvedTemplateSource } from "./types";

type RenderTemplatePlugin = Plugin & {
	settings: {
		templateCommandSettings: import("../../settings/templateCommand").TemplateCommandSettings;
	};
};

function buildDefinitions(
	source: ResolvedTemplateSource,
	input: { destination?: string }
): Array<{ templatePath: string; templateBody: string; outputPathTemplate: string; scriptSource?: string }> {
	if (source.mode === "single-file") {
		const parsed = parseInlineTemplateScript(source.templateContent, {
			allow: true,
			path: source.templatePath
		});
		return [
			{
				templatePath: source.templatePath,
				templateBody: parsed.templateBody,
				outputPathTemplate: input.destination ?? "",
				scriptSource: parsed.scriptSource
			}
		];
	}

	return source.manifest.outputs.map((output) => {
		const parsed = parseInlineTemplateScript(source.templateFiles[output.template], {
			allow: true,
			path: `${source.templateRootPath}/${output.template}`
		});
		return {
			templatePath: `${source.templateRootPath}/${output.template}`,
			templateBody: parsed.templateBody,
			outputPathTemplate: output.path,
			scriptSource: parsed.scriptSource
		};
	});
}

export function registerRenderTemplateCliHandler(plugin: RenderTemplatePlugin): void {
	const handler: CliHandler = async (params) => {
		if (isManualRequest(params)) {
			return renderCommandReference(renderTemplateCommandSpec);
		}

		const parsedArgs = parseRenderTemplateCliArgs(params);
		if (!parsedArgs.ok) {
			return parsedArgs.message;
		}

		if (!parsedArgs.value.template) {
			return "The --template option is required.";
		}

		try {
			const source = await resolveTemplateSource(
				plugin,
				parsedArgs.value.template,
				plugin.settings.templateCommandSettings
			);
			const options = parseRenderTemplateOptions({
				template: parsedArgs.value.template,
				mode: source.mode,
				destination: parsedArgs.value.destination,
				write: parsedArgs.value.write,
				stdout: parsedArgs.value.stdout,
				existingFile: parsedArgs.value.existingFile,
				duplicateOutput: parsedArgs.value.duplicateOutput,
				maxRenderedFiles: plugin.settings.templateCommandSettings.maxRenderedFiles
			});
			const dataSources = await resolveDataSources(plugin, {
				source,
				dataFiles: parsedArgs.value.dataFile,
				inlineData: parsedArgs.value.data,
				set: parsedArgs.value.set
			});
			const data = mergeTemplateData([
				...dataSources.defaultData,
				...dataSources.dataFiles,
				dataSources.inlineData,
				...dataSources.set
			]);
			const system = createTemplateSystemContext();
			const definitions = buildDefinitions(source, parsedArgs.value);
			const definitionsWithScript = [];
			for (const definition of definitions) {
				const scriptData = await runInlineTemplateScript(
					definition.scriptSource,
					buildObsidianTemplateApi({
						plugin,
						template: parsedArgs.value.template,
						mode: source.mode,
						destination: parsedArgs.value.destination,
						dryRun: options.dryRun,
						data,
						system
					}),
					definition.templatePath
				);
				definitionsWithScript.push({
					templatePath: definition.templatePath,
					templateBody: definition.templateBody,
					outputPathTemplate: definition.outputPathTemplate,
					scriptData
				});
			}
			const plan = renderTemplateBundle({
				template: parsedArgs.value.template,
				mode: source.mode,
				dryRun: options.dryRun,
				definitions: definitionsWithScript,
				runtimeFactory: (definition) =>
					buildTemplateRuntime({
						data,
						script: definition.scriptData,
						system
					}),
				partials: source.mode === "bundle" ? source.partials : undefined,
				outputRoot: source.mode === "bundle" ? options.destination : undefined
			});
			const result = await applyRenderPlan(plugin, plan, {
				existingFile: options.existingFile,
				duplicateOutput: options.duplicateOutput,
				settings: plugin.settings.templateCommandSettings
			});
			return formatRenderTemplateResult({
				plan,
				result,
				stdout: options.stdout
			});
		} catch (error) {
			if (error instanceof UserError) {
				return error.message;
			}

			return error instanceof Error
				? `Template render failed unexpectedly: ${error.message}`
				: "Template render failed unexpectedly.";
		}
	};

	plugin.registerCliHandler(
		renderTemplateCommandSpec.name,
		renderTemplateCommandSpec.summary,
		buildCliFlags(renderTemplateCommandSpec),
		handler
	);
}
