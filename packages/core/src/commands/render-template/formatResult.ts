import type { RenderTemplatePlan, RenderTemplateResult, RenderTemplateStdoutMode } from "./types";

function formatStatusText(result: RenderTemplateResult): string {
	const headline = `Rendered ${result.files.length} ${result.files.length === 1 ? "file" : "files"}.`;
	const details = result.files.map((file) => `- ${file.path} (${file.status})`);
	return [headline, ...details].join("\n");
}

function formatContentText(plan: RenderTemplatePlan): string {
	if (plan.mode === "single-file") {
		return plan.files[0]?.content ?? "";
	}

	return plan.files.map((file) => `=== file: ${file.path} ===\n${file.content}`).join("\n\n");
}

export function formatRenderTemplateResult(input: {
	plan: RenderTemplatePlan;
	result: RenderTemplateResult;
	stdout: RenderTemplateStdoutMode;
}): string {
	if (input.stdout === "status/text") {
		return formatStatusText(input.result);
	}

	if (input.stdout === "status/json") {
		return JSON.stringify(input.result, null, 2);
	}

	if (input.stdout === "content/text") {
		return formatContentText(input.plan);
	}

	if (input.stdout === "status+content/text") {
		return `${formatStatusText(input.result)}\n\n${formatContentText(input.plan)}`;
	}

	return JSON.stringify(
		{
			result: input.result,
			contents: input.plan.files.map((file) => ({
				path: file.path,
				template: file.template,
				content: file.content,
				bytes: file.bytes
			}))
		},
		null,
		2
	);
}
