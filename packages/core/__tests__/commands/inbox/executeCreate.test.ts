import { describe, expect, it } from "vitest";
import { executeCreate } from "../../../src/commands/inbox/executeCreate";
import type { SuggestionCard } from "../../../src/commands/inbox/types";

const NOW = new Date("2026-04-09T10:00:00.000Z");
const BASE_INPUT = {
	kind: "idea" as const,
	title: "Test idea",
	summary: "",
	relatedPaths: [],
	priority: "medium" as const,
	source: "cli",
	now: NOW,
	dismissCooldownDays: 7
};

function makeCard(overrides: Partial<SuggestionCard>): SuggestionCard {
	return {
		id: "ibx_20260409_aa01",
		status: "open",
		kind: "idea",
		priority: "medium",
		title: "Test idea",
		summary: "",
		source: { command: "cli", runAt: NOW.toISOString() },
		relatedPaths: [],
		fingerprint: "cli:test-idea",
		seenCount: 1,
		createdAt: NOW.toISOString(),
		updatedAt: NOW.toISOString(),
		...overrides
	};
}

describe("executeCreate", () => {
	it("creates a new card when store is empty", () => {
		const { cards, result } = executeCreate([], BASE_INPUT);
		expect(result.created).toBe(true);
		expect(cards).toHaveLength(1);
		if (result.created) {
			expect(result.card.kind).toBe("idea");
			expect(result.card.title).toBe("Test idea");
			expect(result.card.seenCount).toBe(1);
			expect(result.card.status).toBe("open");
		}
	});

	it("aggregates into open card with same fingerprint", () => {
		const existing = makeCard({ status: "open", seenCount: 1 });
		const { cards, result } = executeCreate([existing], BASE_INPUT);

		expect(result.created).toBe(false);
		if (!result.created) {
			expect(result.reason).toBe("duplicate_open");
			expect(result.card.seenCount).toBe(2);
			expect(result.card.id).toBe(existing.id);
		}
		expect(cards).toHaveLength(1);
	});

	it("aggregates into snoozed card with same fingerprint", () => {
		const existing = makeCard({ status: "snoozed", seenCount: 2 });
		const { result } = executeCreate([existing], BASE_INPUT);

		expect(result.created).toBe(false);
		if (!result.created) {
			expect(result.reason).toBe("duplicate_open");
			expect(result.card.seenCount).toBe(3);
		}
	});

	it("creates new card when existing card is done", () => {
		const existing = makeCard({ status: "done" });
		const { cards, result } = executeCreate([existing], BASE_INPUT);

		expect(result.created).toBe(true);
		expect(cards).toHaveLength(2);
	});

	it("suppresses re-creation within dismiss cooldown", () => {
		const dismissedAt = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
		const existing = makeCard({ status: "dismissed", dismissedAt: dismissedAt.toISOString() });
		const { cards, result } = executeCreate([existing], BASE_INPUT);

		expect(result.created).toBe(false);
		if (!result.created) {
			expect(result.reason).toBe("duplicate_dismissed_cooldown");
		}
		expect(cards).toHaveLength(1);
	});

	it("creates new card after dismiss cooldown has passed", () => {
		const dismissedAt = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
		const existing = makeCard({ status: "dismissed", dismissedAt: dismissedAt.toISOString() });
		const { cards, result } = executeCreate([existing], BASE_INPUT);

		expect(result.created).toBe(true);
		expect(cards).toHaveLength(2);
	});

	it("uses caller-supplied fingerprint when provided", () => {
		const { result } = executeCreate([], { ...BASE_INPUT, fingerprint: "my-custom-fp" });
		expect(result.created).toBe(true);
		if (result.created) {
			expect(result.card.fingerprint).toBe("my-custom-fp");
		}
	});

	it("auto-generates fingerprint from source and title", () => {
		const { result } = executeCreate([], BASE_INPUT);
		expect(result.created).toBe(true);
		if (result.created) {
			expect(result.card.fingerprint).toBe("cli:test-idea");
		}
	});

	it("stores relatedPaths and source", () => {
		const { result } = executeCreate([], {
			...BASE_INPUT,
			relatedPaths: ["notes/a.md", "notes/b.md"],
			source: "plugin-audit"
		});
		if (result.created) {
			expect(result.card.relatedPaths).toEqual(["notes/a.md", "notes/b.md"]);
			expect(result.card.source.command).toBe("plugin-audit");
		}
	});
});
