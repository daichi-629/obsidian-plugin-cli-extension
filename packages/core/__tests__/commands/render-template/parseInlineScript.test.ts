import { describe, expect, it } from "vitest";
import { parseInlineTemplateScript } from "../../../src";

describe("parseInlineTemplateScript", () => {
	it("extracts a leading template-script block", () => {
		expect(
			parseInlineTemplateScript(
				"```template-script\nexport async function buildContext(api) {\n\treturn { title: api.data.title };\n}\n```\n\n# <%= it.data.title %>\n"
			)
		).toEqual({
			scriptSource:
				"export async function buildContext(api) {\n\treturn { title: api.data.title };\n}",
			templateBody: "\n# <%= it.data.title %>\n"
		});
	});
});
