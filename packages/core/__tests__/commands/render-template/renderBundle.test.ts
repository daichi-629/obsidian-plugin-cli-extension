import { buildTemplateRuntime, createTemplateSystemContext, renderTemplateBundle } from "../../../src";
import { describe, expect, it, vi } from "vitest";

describe("renderTemplateBundle", () => {
	it("renders content, paths, and partials", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.123456789);
		const system = createTemplateSystemContext(new Date("2026-04-08T00:00:00.000Z"));

		const result = renderTemplateBundle({
			template: "bundle",
			mode: "bundle",
			dryRun: true,
			definitions: [
				{
					templatePath: "templates/project/README.md",
					templateBody: "# <%= it.data.title %>\n\n<%~ include('./header', it) %>\n",
					outputPathTemplate: "notes/<%= it.path.slug(it.data.title) %>-<%= it.path.shortId() %>.md",
					scriptData: { owner: "alice" }
				}
			],
			partials: {
				header: "Owner: <%= it.script.owner %>"
			},
			runtimeFactory: (definition) =>
				buildTemplateRuntime({
					data: { title: "Atlas Project" },
					script: definition.scriptData,
					system
				})
		});

		expect(result.files).toHaveLength(1);
		expect(result.files[0].path).toBe("notes/atlas-project-4fzzzx.md");
		expect(result.files[0].content).toBe("# Atlas Project\n\nOwner: alice\n");
	});
});
