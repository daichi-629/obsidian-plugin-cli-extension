import { describe, expect, it } from "vitest";
import {
	formatExtensionLines,
	formatPathPrefixLines,
	parseExtensionLines,
	parsePathPrefixLines
} from "../../src/settings/tabState";

describe("tabState", () => {
	it("parses one path prefix per line and normalizes slashes", () => {
		expect(parsePathPrefixLines("projects\n/reference/\n\n daily/notes/ ")).toEqual([
			"projects/",
			"reference/",
			"daily/notes/"
		]);
	});

	it("formats prefixes for textarea editing", () => {
		expect(formatPathPrefixLines(["projects/", "reference/"])).toBe("projects/\nreference/");
	});

	it("parses and formats extension lists", () => {
		expect(parseExtensionLines(".MD\n txt \n\ncanvas")).toEqual(["md", "txt", "canvas"]);
		expect(formatExtensionLines(["md", "txt"])).toBe("md\ntxt");
	});
});
