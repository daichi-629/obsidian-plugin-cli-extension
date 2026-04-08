import { describe, expect, it } from "vitest";
import { generateFingerprint } from "../../../src/commands/inbox/generateFingerprint";

describe("generateFingerprint", () => {
	it("combines source and title slug", () => {
		expect(generateFingerprint("cli", "Unresolved link")).toBe("cli:unresolved-link");
	});

	it("lowercases and replaces non-alphanumeric runs with hyphens", () => {
		expect(generateFingerprint("audit", "Missing [[spec]] in notes/project.md")).toBe(
			"audit:missing-spec-in-notes-project-md"
		);
	});

	it("strips leading and trailing hyphens from slug", () => {
		expect(generateFingerprint("cli", "  hello world  ")).toBe("cli:hello-world");
	});

	it("handles unicode letters correctly", () => {
		expect(generateFingerprint("plugin", "テスト提案")).toBe("plugin:テスト提案");
	});

	it("uses source prefix before colon", () => {
		const fp = generateFingerprint("plugin-audit", "Some title");
		expect(fp.startsWith("plugin-audit:")).toBe(true);
	});
});
