import { describe, expect, it } from "vitest";
import { parseApplyPatchCliArgs } from "../../../src/commands/apply-patch/parseCliArgs";

describe("parseApplyPatchCliArgs", () => {
	it("accepts boolean flags from the cli adapter", () => {
		expect(
			parseApplyPatchCliArgs({ patch: "*** Begin Patch", dryRun: true, verbose: "true" })
		).toEqual({
			ok: true,
			value: {
				patch: "*** Begin Patch",
				patchFile: undefined,
				dryRun: true,
				allowCreate: false,
				verbose: true
			}
		});
	});

	it("rejects missing patch sources", () => {
		expect(parseApplyPatchCliArgs({})).toEqual({
			ok: false,
			message: "Specify exactly one of --patch or --patch-file."
		});
	});

	it("rejects duplicate patch sources", () => {
		expect(parseApplyPatchCliArgs({ patch: "x", "patch-file": "y" })).toEqual({
			ok: false,
			message: "Specify exactly one of --patch or --patch-file."
		});
	});
});
