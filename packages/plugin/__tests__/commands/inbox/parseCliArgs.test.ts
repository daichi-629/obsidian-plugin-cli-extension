import { describe, expect, it } from "vitest";
import {
	parseInboxCreateCliArgs,
	parseInboxDeleteCliArgs,
	parseInboxListCliArgs,
	parseInboxShowCliArgs,
	parseInboxUpdateCliArgs
} from "../../../src/commands/inbox/parseCliArgs";

describe("parseInboxCreateCliArgs", () => {
	it("parses valid create args", () => {
		expect(
			parseInboxCreateCliArgs({
				kind: "idea",
				title: "Test proposal",
				summary: "Some details",
				related: "notes/a.md,notes/b.md",
				priority: "high",
				source: "plugin-audit",
				fingerprint: "custom-fp",
				format: "json"
			})
		).toEqual({
			ok: true,
			value: {
				kind: "idea",
				title: "Test proposal",
				summary: "Some details",
				relatedPaths: ["notes/a.md", "notes/b.md"],
				priority: "high",
				source: "plugin-audit",
				fingerprint: "custom-fp",
				format: "json"
			}
		});
	});

	it("uses defaults for optional fields", () => {
		const result = parseInboxCreateCliArgs({ kind: "issue", title: "My issue" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.priority).toBe("medium");
			expect(result.value.source).toBe("cli");
			expect(result.value.summary).toBe("");
			expect(result.value.relatedPaths).toEqual([]);
			expect(result.value.fingerprint).toBeUndefined();
			expect(result.value.format).toBe("text");
		}
	});

	it("requires kind", () => {
		expect(parseInboxCreateCliArgs({ title: "x" })).toMatchObject({ ok: false });
	});

	it("requires title", () => {
		expect(parseInboxCreateCliArgs({ kind: "idea" })).toMatchObject({ ok: false });
	});

	it("rejects invalid kind", () => {
		expect(parseInboxCreateCliArgs({ kind: "bug", title: "x" })).toMatchObject({ ok: false });
	});

	it("rejects invalid priority", () => {
		expect(
			parseInboxCreateCliArgs({ kind: "idea", title: "x", priority: "urgent" })
		).toMatchObject({ ok: false });
	});

	it("rejects invalid format", () => {
		expect(parseInboxCreateCliArgs({ kind: "idea", title: "x", format: "tsv" })).toMatchObject({
			ok: false
		});
	});
});

describe("parseInboxListCliArgs", () => {
	it("uses default status when omitted", () => {
		const result = parseInboxListCliArgs({});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status).toEqual(["open", "snoozed"]);
			expect(result.value.kind).toBeNull();
			expect(result.value.priority).toBeNull();
			expect(result.value.limit).toBeNull();
		}
	});

	it("parses comma-separated status", () => {
		const result = parseInboxListCliArgs({ status: "done,dismissed" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status).toEqual(["done", "dismissed"]);
		}
	});

	it("rejects invalid status value", () => {
		expect(parseInboxListCliArgs({ status: "open,unknown" })).toMatchObject({ ok: false });
	});

	it("parses limit as positive integer", () => {
		const result = parseInboxListCliArgs({ limit: "5" });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.limit).toBe(5);
	});

	it("rejects non-positive limit", () => {
		expect(parseInboxListCliArgs({ limit: "0" })).toMatchObject({ ok: false });
		expect(parseInboxListCliArgs({ limit: "-1" })).toMatchObject({ ok: false });
	});
});

describe("parseInboxShowCliArgs", () => {
	it("parses valid id", () => {
		const result = parseInboxShowCliArgs({ id: "ibx_20260409_aa01" });
		expect(result).toEqual({
			ok: true,
			value: { id: "ibx_20260409_aa01", format: "text" }
		});
	});

	it("requires id", () => {
		expect(parseInboxShowCliArgs({})).toMatchObject({ ok: false });
	});
});

describe("parseInboxUpdateCliArgs", () => {
	it("parses status update", () => {
		const result = parseInboxUpdateCliArgs({ id: "ibx_1", status: "done" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.status).toBe("done");
		}
	});

	it("requires at least one change field", () => {
		expect(parseInboxUpdateCliArgs({ id: "ibx_1" })).toMatchObject({ ok: false });
	});

	it("rejects until with non-snoozed status", () => {
		expect(
			parseInboxUpdateCliArgs({
				id: "ibx_1",
				status: "done",
				until: "2026-04-16T09:00:00.000Z"
			})
		).toMatchObject({ ok: false });
	});

	it("accepts until with status=snoozed", () => {
		const result = parseInboxUpdateCliArgs({
			id: "ibx_1",
			status: "snoozed",
			until: "2026-04-16T09:00:00.000Z"
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.snoozedUntil).toBe("2026-04-16T09:00:00.000Z");
		}
	});

	it("rejects invalid iso8601 for until", () => {
		expect(
			parseInboxUpdateCliArgs({ id: "ibx_1", status: "snoozed", until: "not-a-date" })
		).toMatchObject({ ok: false });
	});
});

describe("parseInboxDeleteCliArgs", () => {
	it("parses valid id", () => {
		expect(parseInboxDeleteCliArgs({ id: "ibx_20260409_aa01" })).toEqual({
			ok: true,
			value: { id: "ibx_20260409_aa01" }
		});
	});

	it("requires id", () => {
		expect(parseInboxDeleteCliArgs({})).toMatchObject({ ok: false });
	});
});
