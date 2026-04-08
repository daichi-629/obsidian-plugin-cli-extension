import { describe, expect, it } from "vitest";
import { executeDelete } from "../../../src/commands/inbox/executeDelete";
import type { SuggestionCard } from "../../../src/commands/inbox/types";

function makeCard(id: string): SuggestionCard {
	return {
		id,
		status: "open",
		kind: "idea",
		priority: "medium",
		title: "Card",
		summary: "",
		source: { command: "cli", runAt: "2026-04-09T10:00:00.000Z" },
		relatedPaths: [],
		fingerprint: `fp:${id}`,
		seenCount: 1,
		createdAt: "2026-04-09T10:00:00.000Z",
		updatedAt: "2026-04-09T10:00:00.000Z"
	};
}

describe("executeDelete", () => {
	it("deletes an existing card and returns deleted=true", () => {
		const card = makeCard("ibx_1");
		const { cards, deleted } = executeDelete([card], "ibx_1");
		expect(deleted).toBe(true);
		expect(cards).toHaveLength(0);
	});

	it("returns deleted=false when card does not exist", () => {
		const card = makeCard("ibx_1");
		const { cards, deleted } = executeDelete([card], "ibx_999");
		expect(deleted).toBe(false);
		expect(cards).toHaveLength(1);
	});

	it("only removes the targeted card from the array", () => {
		const cards = [makeCard("ibx_1"), makeCard("ibx_2"), makeCard("ibx_3")];
		const { cards: remaining } = executeDelete(cards, "ibx_2");
		expect(remaining.map((c) => c.id)).toEqual(["ibx_1", "ibx_3"]);
	});

	it("handles empty store", () => {
		const { cards, deleted } = executeDelete([], "ibx_1");
		expect(deleted).toBe(false);
		expect(cards).toHaveLength(0);
	});
});
