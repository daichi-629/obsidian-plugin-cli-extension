import { describe, expect, it } from "vitest";
import {
	buildCliFlags,
	buildSynopsis,
	isManualRequest,
	renderCommandReference
} from "../../../src/shared/cli/commandReference";
import { grepCommandSpec } from "../../../src/commands/grep/spec";

describe("commandReference", () => {
	it("adds the shared man flag to cli registration metadata", () => {
		expect(buildCliFlags(grepCommandSpec)).toMatchObject({
			pattern: {
				value: "<pattern>",
				description: "Search pattern. Uses regular expressions unless fixed-strings is set."
			},
			man: {
				description: "Print the detailed command reference."
			}
		});
	});

	it("treats bare man flags as manual requests", () => {
		expect(isManualRequest({ man: true })).toBe(true);
		expect(isManualRequest({ man: "true" })).toBe(true);
		expect(isManualRequest({ man: "false" })).toBe(false);
	});

	it("appends the manual synopsis line", () => {
		expect(buildSynopsis(grepCommandSpec)).toEqual([
			"obsidian sample-monorepo-plugin-grep pattern=<pattern> [path=<vault-prefix[,vault-prefix...]>] [exclude-path=<vault-prefix[,vault-prefix...]>] [fixed-strings] [ignore-case] [line-number] [files-with-matches] [count] [before-context=<number>] [after-context=<number>] [context=<number>] [max-results=<number>] [stats] [json]",
			"obsidian sample-monorepo-plugin-grep man"
		]);
	});

	it("renders a man-style reference", () => {
		const reference = renderCommandReference(grepCommandSpec);

		expect(reference).toContain(
			"NAME\n  sample-monorepo-plugin-grep - Search vault files with grep-style output modes."
		);
		expect(reference).toContain(
			"SYNOPSIS\n  obsidian sample-monorepo-plugin-grep pattern=<pattern> [path=<vault-prefix[,vault-prefix...]>] [exclude-path=<vault-prefix[,vault-prefix...]>] [fixed-strings] [ignore-case] [line-number] [files-with-matches] [count] [before-context=<number>] [after-context=<number>] [context=<number>] [max-results=<number>] [stats] [json]\n  obsidian sample-monorepo-plugin-grep man"
		);
		expect(reference).toContain("OPTIONS\n  pattern=<pattern>");
		expect(reference).toContain(
			"Search pattern. Uses regular expressions unless fixed-strings is set. Required."
		);
		expect(reference).toContain("exclude-path=<vault-prefix[,vault-prefix...]>");
		expect(reference).toContain("context=<number>");
		expect(reference).toContain(
			"Render matches and aggregate search stats as JSON instead of plain text."
		);
		expect(reference).toContain("SEE ALSO\n  sample-monorepo-plugin-apply-patch");
	});
});
