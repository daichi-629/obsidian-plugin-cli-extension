import { describe, expect, it } from "vitest";
import { mergeTemplateData } from "../../../src";

describe("mergeTemplateData", () => {
	it("deep merges objects and replaces arrays", () => {
		expect(
			mergeTemplateData([
				{ nested: { title: "Atlas", tags: ["a"] } },
				{ nested: { status: "draft", tags: ["b", "c"] } }
			])
		).toEqual({
			nested: { title: "Atlas", status: "draft", tags: ["b", "c"] }
		});
	});
});
