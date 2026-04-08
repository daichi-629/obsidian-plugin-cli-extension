import { describe, expect, it } from "vitest";
import { formatRenderTemplateResult } from "../../../src";

describe("formatRenderTemplateResult", () => {
	it("formats plain text summaries", () => {
		expect(
			formatRenderTemplateResult({
				plan: {
					template: "bundle",
					mode: "bundle",
					dryRun: false,
					files: [
						{ path: "README.md", template: "README.md", content: "# Atlas\n", bytes: 10 },
						{
							path: "notes/atlas.md",
							template: "notes/index.md",
							content: "Overview\n",
							bytes: 20
						}
					]
				},
				result: {
					template: "bundle",
					mode: "bundle",
					dryRun: false,
					files: [
						{ path: "README.md", template: "README.md", status: "created", bytes: 10 },
						{ path: "notes/atlas.md", template: "notes/index.md", status: "replaced", bytes: 20 }
					]
				},
				stdout: "status/text"
			})
		).toBe("Rendered 2 files.\n- README.md (created)\n- notes/atlas.md (replaced)");
	});

	it("formats bundle content with delimiters", () => {
		expect(
			formatRenderTemplateResult({
				plan: {
					template: "bundle",
					mode: "bundle",
					dryRun: true,
					files: [
						{ path: "projects/atlas/README.md", template: "README.md", content: "# Atlas\n", bytes: 8 },
						{
							path: "projects/atlas/docs/overview.md",
							template: "overview.md",
							content: "Overview\n",
							bytes: 9
						}
					]
				},
				result: {
					template: "bundle",
					mode: "bundle",
					dryRun: true,
					files: [
						{ path: "projects/atlas/README.md", template: "README.md", status: "planned", bytes: 8 },
						{
							path: "projects/atlas/docs/overview.md",
							template: "overview.md",
							status: "planned",
							bytes: 9
						}
					]
				},
				stdout: "content/text"
			})
		).toBe(
			"=== file: projects/atlas/README.md ===\n# Atlas\n\n\n=== file: projects/atlas/docs/overview.md ===\nOverview\n"
		);
	});
});
