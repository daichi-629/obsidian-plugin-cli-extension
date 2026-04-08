import { describe, expect, it } from "vitest";
import { registerInboxCliHandlers } from "../../../src/commands/inbox/registerCliHandler";
import type { InboxSettings } from "../../../src/inbox/inboxSettings";

type CapturedHandler = (params: Record<string, string | boolean>) => Promise<string> | string;

const INBOX_SETTINGS: InboxSettings = { dismissCooldownDays: 7 };

function createPlugin(vaultFiles: Set<string> = new Set()) {
	const handlers = new Map<string, CapturedHandler>();
	let storedData: Record<string, unknown> = {};

	const store = {
		async loadCards() {
			const inbox = storedData["inboxStore"] as { version: 1; cards: unknown[] } | undefined;
			return Array.isArray(inbox?.cards) ? inbox.cards : [];
		},
		async saveCards(cards: unknown[]) {
			storedData = { ...storedData, inboxStore: { version: 1, cards } };
		}
	};

	const plugin = {
		app: {
			vault: {
				getFileByPath(path: string) {
					return vaultFiles.has(path) ? { path } : null;
				}
			}
		},
		registerCliHandler(
			name: string,
			_summary: string,
			_flags: Record<string, unknown>,
			handler: CapturedHandler
		) {
			handlers.set(name, handler);
		}
	};

	registerInboxCliHandlers(plugin as never, store as never, INBOX_SETTINGS);
	return { handlers, store };
}

describe("registerInboxCliHandlers", () => {
	it("registers all 5 inbox handlers", () => {
		const { handlers } = createPlugin();
		expect([...handlers.keys()].sort()).toEqual([
			"excli-inbox:create",
			"excli-inbox:delete",
			"excli-inbox:list",
			"excli-inbox:show",
			"excli-inbox:update"
		]);
	});

	it("create returns Created: <id> for new card", async () => {
		const { handlers } = createPlugin();
		const output = await handlers.get("excli-inbox:create")!({
			kind: "idea",
			title: "Test proposal"
		});
		expect(output).toMatch(/^Created: ibx_\d{8}_[0-9a-f]{4}$/);
	});

	it("create returns json result", async () => {
		const { handlers } = createPlugin();
		const output = await handlers.get("excli-inbox:create")!({
			kind: "issue",
			title: "My issue",
			format: "json"
		});
		const parsed = JSON.parse(output) as { created: boolean; card: { kind: string } };
		expect(parsed.created).toBe(true);
		expect(parsed.card.kind).toBe("issue");
	});

	it("list returns cards after creation", async () => {
		const { handlers } = createPlugin();
		await handlers.get("excli-inbox:create")!({ kind: "idea", title: "First" });
		await handlers.get("excli-inbox:create")!({
			kind: "issue",
			title: "Second",
			priority: "high"
		});

		const output = await handlers.get("excli-inbox:list")!({ format: "text" });
		expect(output).toContain("Second"); // high priority appears first
		expect(output).toContain("First");
		expect(output).toContain("2 cards (total: 2)");
	});

	it("show returns card details", async () => {
		const { handlers } = createPlugin();
		const createOutput = await handlers.get("excli-inbox:create")!({
			kind: "review",
			title: "Review this",
			format: "json"
		});
		const { card } = JSON.parse(createOutput) as { card: { id: string } };

		const showOutput = await handlers.get("excli-inbox:show")!({ id: card.id, format: "json" });
		expect(JSON.parse(showOutput)).toMatchObject({ id: card.id, kind: "review" });
	});

	it("show returns error for unknown id", async () => {
		const { handlers } = createPlugin();
		const output = await handlers.get("excli-inbox:show")!({ id: "ibx_does_not_exist" });
		expect(output).toContain("not found");
	});

	it("update changes status and returns Updated:", async () => {
		const { handlers } = createPlugin();
		const createOut = await handlers.get("excli-inbox:create")!({
			kind: "idea",
			title: "To update",
			format: "json"
		});
		const { card } = JSON.parse(createOut) as { card: { id: string } };

		const updateOut = await handlers.get("excli-inbox:update")!({
			id: card.id,
			status: "done"
		});
		expect(updateOut).toBe(`Updated: ${card.id}`);
	});

	it("delete removes card from store", async () => {
		const { handlers } = createPlugin();
		const createOut = await handlers.get("excli-inbox:create")!({
			kind: "idea",
			title: "To delete",
			format: "json"
		});
		const { card } = JSON.parse(createOut) as { card: { id: string } };

		await handlers.get("excli-inbox:delete")!({ id: card.id });

		const listOut = await handlers.get("excli-inbox:list")!({});
		expect(listOut).toContain("0 cards");
	});

	it("returns manual reference for man=true", async () => {
		const { handlers } = createPlugin();
		const out = await handlers.get("excli-inbox:create")!({ man: true });
		expect(out).toContain("excli-inbox:create");
		expect(out).toContain("NAME");
	});

	it("create returns usage error for missing kind", async () => {
		const { handlers } = createPlugin();
		const out = await handlers.get("excli-inbox:create")!({ title: "oops" });
		expect(out).toContain("kind");
	});

	it("create accepts related paths that exist in the vault", async () => {
		const { handlers } = createPlugin(new Set(["notes/a.md"]));
		const out = await handlers.get("excli-inbox:create")!({
			kind: "idea",
			title: "With related",
			related: "notes/a.md",
			format: "json"
		});
		const parsed = JSON.parse(out) as { created: boolean; card: { relatedPaths: string[] } };
		expect(parsed.created).toBe(true);
		expect(parsed.card.relatedPaths).toEqual(["notes/a.md"]);
	});

	it("create rejects related paths that do not exist in the vault", async () => {
		const { handlers } = createPlugin(new Set());
		const out = await handlers.get("excli-inbox:create")!({
			kind: "idea",
			title: "Bad related",
			related: "notes/missing.md"
		});
		expect(out).toContain("not found in vault");
		expect(out).toContain("notes/missing.md");
	});
});
