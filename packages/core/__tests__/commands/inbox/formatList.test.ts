import { describe, expect, it } from "vitest";
import { formatList } from "../../../src/commands/inbox/formatList";
import type { InboxListResult } from "../../../src/commands/inbox/types";

function makeResult(overrides: Partial<InboxListResult> = {}): InboxListResult {
	return {
		filter: { status: ["open", "snoozed"], kind: null, priority: null, limit: null },
		totalCount: 3,
		displayedCount: 2,
		cards: [
			{
				id: "ibx_20260409_aa01",
				status: "open",
				kind: "issue",
				priority: "high",
				title: "Unresolved link in notes/project.md",
				createdAt: "2026-04-09T10:00:00.000Z",
				seenCount: 1
			},
			{
				id: "ibx_20260409_bb02",
				status: "open",
				kind: "idea",
				priority: "medium",
				title: "Bridge llm-safety and release",
				createdAt: "2026-04-09T11:00:00.000Z",
				seenCount: 2
			}
		],
		...overrides
	};
}

describe("formatList", () => {
	it("returns json when format=json", () => {
		const result = makeResult();
		const output = formatList(result, "json");
		expect(JSON.parse(output)).toMatchObject({ displayedCount: 2 });
	});

	it("renders compact text lines with status/priority badge and id", () => {
		const output = formatList(makeResult(), "text");
		expect(output).toContain("ibx_20260409_aa01");
		expect(output).toContain("ibx_20260409_bb02");
		expect(output).toContain("[open/high]");
		expect(output).toContain("[open/medium]");
		expect(output).toContain("Unresolved link in notes/project.md");
	});

	it("appends count line", () => {
		const output = formatList(makeResult(), "text");
		expect(output).toContain("2 cards (total: 3)");
	});

	it("returns zero count line when cards is empty", () => {
		const result = makeResult({ cards: [], displayedCount: 0 });
		const output = formatList(result, "text");
		expect(output).toBe("0 cards (total: 3)");
	});
});
