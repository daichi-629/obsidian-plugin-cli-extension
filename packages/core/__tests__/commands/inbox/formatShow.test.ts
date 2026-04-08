import { describe, expect, it } from "vitest";
import { formatShow } from "../../../src/commands/inbox/formatShow";
import type { SuggestionCard } from "../../../src/commands/inbox/types";

const CARD: SuggestionCard = {
	id: "ibx_20260409_aa01",
	status: "open",
	kind: "issue",
	priority: "high",
	title: "Unresolved link in notes/project.md",
	summary: "[[missing-spec]] へのリンク先が存在しません。",
	source: { command: "plugin-audit", runAt: "2026-04-09T12:00:00.000Z" },
	relatedPaths: ["notes/project.md"],
	fingerprint: "plugin-audit:unresolved-link-in-notes-project-md",
	seenCount: 1,
	createdAt: "2026-04-09T12:00:00.000Z",
	updatedAt: "2026-04-09T12:00:00.000Z"
};

describe("formatShow", () => {
	it("returns json when format=json", () => {
		const output = formatShow(CARD, "json");
		expect(JSON.parse(output)).toMatchObject({ id: CARD.id, kind: CARD.kind });
	});

	it("renders key-value text for all core fields", () => {
		const output = formatShow(CARD, "text");
		expect(output).toContain("ID:        ibx_20260409_aa01");
		expect(output).toContain("Kind:      issue");
		expect(output).toContain("Status:    open");
		expect(output).toContain("Priority:  high");
		expect(output).toContain("Title:     Unresolved link in notes/project.md");
		expect(output).toContain("Source:    plugin-audit");
		expect(output).toContain("Related:   notes/project.md");
		expect(output).toContain("Seen:      1");
		expect(output).toContain("Created:   2026-04-09T12:00:00.000Z");
	});

	it("returns not-found message when card is null", () => {
		expect(formatShow(null, "text")).toBe("Card not found.");
		expect(JSON.parse(formatShow(null, "json"))).toBe(null);
	});

	it("includes snoozedUntil when set", () => {
		const snoozed = {
			...CARD,
			status: "snoozed" as const,
			snoozedUntil: "2026-04-16T09:00:00.000Z"
		};
		const output = formatShow(snoozed, "text");
		expect(output).toContain("Snoozed:   2026-04-16T09:00:00.000Z");
	});
});
