import { describe, expect, it } from "vitest";
import {
	parseTraverseClustersCliArgs,
	parseTraversePathCliArgs,
	parseTraverseReachCliArgs
} from "../../../src/commands/traverse/parseCliArgs";

describe("traverse cli parsing", () => {
	it("parses reach options", () => {
		expect(
			parseTraverseReachCliArgs({
				from: "Atlas",
				depth: "2",
				direction: "both",
				folder: "/projects/",
				tag: "#project",
				format: "json"
			})
		).toEqual({
			ok: true,
			value: {
				from: "Atlas",
				depth: 2,
				direction: "both",
				folder: "/projects/",
				tag: "#project",
				format: "json"
			}
		});
	});

	it("rejects invalid path mode direction", () => {
		expect(
			parseTraversePathCliArgs({
				from: "a",
				to: "b",
				direction: "in"
			})
		).toEqual({
			ok: false,
			message: "The --direction option must be out or both."
		});
	});

	it("parses clusters options and validates min-size", () => {
		expect(
			parseTraverseClustersCliArgs({
				tag: "idea",
				"min-size": "3",
				format: "tsv"
			})
		).toEqual({
			ok: true,
			value: {
				folder: undefined,
				tag: "idea",
				minSize: 3,
				format: "tsv"
			}
		});
		expect(parseTraverseClustersCliArgs({ "min-size": "0" })).toEqual({
			ok: false,
			message: "The --min-size option must be a positive integer."
		});
	});
});
