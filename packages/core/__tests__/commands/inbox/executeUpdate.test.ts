import { describe, expect, it } from "vitest";
import { executeUpdate } from "../../../src/commands/inbox/executeUpdate";
import type { SuggestionCard } from "../../../src/commands/inbox/types";

const NOW = new Date("2026-04-09T12:00:00.000Z");

function makeCard(overrides: Partial<SuggestionCard> = {}): SuggestionCard {
	return {
		id: "ibx_20260409_aa01",
		status: "open",
		kind: "idea",
		priority: "medium",
		title: "Original",
		summary: "",
		source: { command: "cli", runAt: "2026-04-09T10:00:00.000Z" },
		relatedPaths: [],
		fingerprint: "cli:original",
		seenCount: 1,
		createdAt: "2026-04-09T10:00:00.000Z",
		updatedAt: "2026-04-09T10:00:00.000Z",
		...overrides
	};
}

describe("executeUpdate", () => {
	it("returns null for non-existent id", () => {
		const { updated } = executeUpdate([], { id: "does-not-exist", now: NOW });
		expect(updated).toBeNull();
	});

	it("updates title and summary", () => {
		const card = makeCard();
		const { updated } = executeUpdate([card], {
			id: card.id,
			title: "New title",
			summary: "New summary",
			now: NOW
		});
		expect(updated?.title).toBe("New title");
		expect(updated?.summary).toBe("New summary");
		expect(updated?.updatedAt).toBe(NOW.toISOString());
	});

	it("sets dismissedAt when transitioning to dismissed", () => {
		const card = makeCard();
		const { updated } = executeUpdate([card], { id: card.id, status: "dismissed", now: NOW });
		expect(updated?.status).toBe("dismissed");
		expect(updated?.dismissedAt).toBe(NOW.toISOString());
	});

	it("sets snoozedUntil when transitioning to snoozed", () => {
		const card = makeCard();
		const until = "2026-04-16T09:00:00.000Z";
		const { updated } = executeUpdate([card], {
			id: card.id,
			status: "snoozed",
			snoozedUntil: until,
			now: NOW
		});
		expect(updated?.status).toBe("snoozed");
		expect(updated?.snoozedUntil).toBe(until);
	});

	it("clears snoozedUntil when transitioning from snoozed to open", () => {
		const card = makeCard({ status: "snoozed", snoozedUntil: "2026-04-16T09:00:00.000Z" });
		const { updated } = executeUpdate([card], { id: card.id, status: "open", now: NOW });
		expect(updated?.status).toBe("open");
		expect(updated?.snoozedUntil).toBeUndefined();
	});

	it("updates kind and priority", () => {
		const card = makeCard();
		const { updated } = executeUpdate([card], {
			id: card.id,
			kind: "review",
			priority: "high",
			now: NOW
		});
		expect(updated?.kind).toBe("review");
		expect(updated?.priority).toBe("high");
	});

	it("does not modify other cards in the array", () => {
		const card1 = makeCard({ id: "ibx_1" });
		const card2 = makeCard({ id: "ibx_2", title: "Other" });
		const { cards } = executeUpdate([card1, card2], {
			id: "ibx_1",
			title: "Changed",
			now: NOW
		});
		expect(cards.find((c) => c.id === "ibx_2")?.title).toBe("Other");
	});
});
