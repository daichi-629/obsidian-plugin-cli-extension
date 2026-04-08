import { describe, expect, it } from "vitest";
import { executeList } from "../../../src/commands/inbox/executeList";
import type { SuggestionCard } from "../../../src/commands/inbox/types";

function makeCard(id: string, overrides: Partial<SuggestionCard>): SuggestionCard {
	return {
		id,
		status: "open",
		kind: "idea",
		priority: "medium",
		title: `Card ${id}`,
		summary: "",
		source: { command: "cli", runAt: "2026-04-09T10:00:00.000Z" },
		relatedPaths: [],
		fingerprint: `fp:${id}`,
		seenCount: 1,
		createdAt: "2026-04-09T10:00:00.000Z",
		updatedAt: "2026-04-09T10:00:00.000Z",
		...overrides
	};
}

const CARDS: SuggestionCard[] = [
	makeCard("a", {
		status: "open",
		priority: "high",
		kind: "issue",
		createdAt: "2026-04-09T08:00:00.000Z"
	}),
	makeCard("b", {
		status: "open",
		priority: "medium",
		kind: "idea",
		createdAt: "2026-04-09T09:00:00.000Z"
	}),
	makeCard("c", {
		status: "snoozed",
		priority: "low",
		kind: "question",
		createdAt: "2026-04-09T07:00:00.000Z"
	}),
	makeCard("d", {
		status: "done",
		priority: "high",
		kind: "review",
		createdAt: "2026-04-09T06:00:00.000Z"
	}),
	makeCard("e", {
		status: "open",
		priority: "high",
		kind: "idea",
		createdAt: "2026-04-09T10:00:00.000Z"
	})
];

describe("executeList", () => {
	it("defaults to open and snoozed status filter", () => {
		const result = executeList(CARDS, {
			status: ["open", "snoozed"],
			kind: null,
			priority: null,
			limit: null
		});
		expect(result.displayedCount).toBe(4); // a, b, c, e
		expect(result.totalCount).toBe(5);
	});

	it("sorts by priority descending then createdAt ascending", () => {
		const result = executeList(CARDS, {
			status: ["open", "snoozed"],
			kind: null,
			priority: null,
			limit: null
		});
		const ids = result.cards.map((c) => c.id);
		// high: a (08:00), e (10:00) → a before e; then medium: b; then low: c
		expect(ids).toEqual(["a", "e", "b", "c"]);
	});

	it("filters by kind", () => {
		const result = executeList(CARDS, {
			status: ["open", "snoozed", "done", "dismissed"],
			kind: "idea",
			priority: null,
			limit: null
		});
		expect(result.cards.every((c) => c.kind === "idea")).toBe(true);
	});

	it("filters by priority", () => {
		const result = executeList(CARDS, {
			status: ["open", "snoozed", "done"],
			kind: null,
			priority: "high",
			limit: null
		});
		expect(result.cards.every((c) => c.priority === "high")).toBe(true);
	});

	it("respects limit", () => {
		const result = executeList(CARDS, {
			status: ["open", "snoozed"],
			kind: null,
			priority: null,
			limit: 2
		});
		expect(result.displayedCount).toBe(2);
		expect(result.cards).toHaveLength(2);
	});

	it("returns done-only filter", () => {
		const result = executeList(CARDS, {
			status: ["done"],
			kind: null,
			priority: null,
			limit: null
		});
		expect(result.cards).toHaveLength(1);
		expect(result.cards[0]!.id).toBe("d");
	});

	it("returns empty array when nothing matches", () => {
		const result = executeList(CARDS, {
			status: ["dismissed"],
			kind: null,
			priority: null,
			limit: null
		});
		expect(result.displayedCount).toBe(0);
		expect(result.totalCount).toBe(5);
	});

	it("includes correct summary fields", () => {
		const result = executeList(CARDS, {
			status: ["open"],
			kind: null,
			priority: null,
			limit: 1
		});
		const summary = result.cards[0]!;
		expect(summary).toHaveProperty("id");
		expect(summary).toHaveProperty("status");
		expect(summary).toHaveProperty("kind");
		expect(summary).toHaveProperty("priority");
		expect(summary).toHaveProperty("title");
		expect(summary).toHaveProperty("createdAt");
		expect(summary).toHaveProperty("seenCount");
	});
});
