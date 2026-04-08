import type { CliData } from "obsidian";
import type { SuggestionCard } from "@sample/core";
import type { PluginCliParseResult } from "../types";

function readValue(params: CliData, key: string): string | undefined {
	const record = params as Record<string, unknown>;
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function readFormat(params: CliData): string {
	return readValue(params, "format") ?? "text";
}

function assertFormat(format: string): PluginCliParseResult<"text" | "json"> | null {
	if (format !== "text" && format !== "json") {
		return { ok: false, message: "The --format option must be text or json." };
	}
	return null;
}

export type InboxCreateCliInput = {
	kind: SuggestionCard["kind"];
	title: string;
	summary: string;
	relatedPaths: string[];
	priority: SuggestionCard["priority"];
	source: string;
	fingerprint?: string;
	format: "text" | "json";
};

export type InboxListCliInput = {
	status: SuggestionCard["status"][];
	kind: SuggestionCard["kind"] | null;
	priority: SuggestionCard["priority"] | null;
	limit: number | null;
	format: "text" | "json";
};

export type InboxShowCliInput = {
	id: string;
	format: "text" | "json";
};

export type InboxUpdateCliInput = {
	id: string;
	status?: SuggestionCard["status"];
	kind?: SuggestionCard["kind"];
	priority?: SuggestionCard["priority"];
	title?: string;
	summary?: string;
	snoozedUntil?: string;
	format: "text" | "json";
};

export type InboxDeleteCliInput = {
	id: string;
};

export function parseInboxCreateCliArgs(
	params: CliData
): PluginCliParseResult<InboxCreateCliInput> {
	const format = readFormat(params);
	const formatErr = assertFormat(format);
	if (formatErr) return formatErr;

	const kind = readValue(params, "kind");
	if (!kind) {
		return {
			ok: false,
			message: "The create command requires kind=<issue|question|idea|review>."
		};
	}
	if (kind !== "issue" && kind !== "question" && kind !== "idea" && kind !== "review") {
		return {
			ok: false,
			message: "The --kind option must be issue, question, idea, or review."
		};
	}

	const title = readValue(params, "title");
	if (!title) {
		return { ok: false, message: "The create command requires title=<text>." };
	}

	const priorityRaw = readValue(params, "priority") ?? "medium";
	if (priorityRaw !== "low" && priorityRaw !== "medium" && priorityRaw !== "high") {
		return { ok: false, message: "The --priority option must be low, medium, or high." };
	}

	const relatedRaw = readValue(params, "related");
	const relatedPaths = relatedRaw
		? relatedRaw
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p.length > 0)
		: [];

	return {
		ok: true,
		value: {
			kind,
			title,
			summary: readValue(params, "summary") ?? "",
			relatedPaths,
			priority: priorityRaw,
			source: readValue(params, "source") ?? "cli",
			fingerprint: readValue(params, "fingerprint"),
			format: format as "text" | "json"
		}
	};
}

export function parseInboxListCliArgs(params: CliData): PluginCliParseResult<InboxListCliInput> {
	const format = readFormat(params);
	const formatErr = assertFormat(format);
	if (formatErr) return formatErr;

	const statusRaw = readValue(params, "status") ?? "open,snoozed";
	const statusParts = statusRaw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	const validStatuses = new Set(["open", "snoozed", "done", "dismissed"]);
	for (const s of statusParts) {
		if (!validStatuses.has(s)) {
			return {
				ok: false,
				message:
					"The --status option must be open, snoozed, done, or dismissed (comma-separated)."
			};
		}
	}

	const kindRaw = readValue(params, "kind");
	if (
		kindRaw &&
		kindRaw !== "issue" &&
		kindRaw !== "question" &&
		kindRaw !== "idea" &&
		kindRaw !== "review"
	) {
		return {
			ok: false,
			message: "The --kind option must be issue, question, idea, or review."
		};
	}

	const priorityRaw = readValue(params, "priority");
	if (
		priorityRaw &&
		priorityRaw !== "low" &&
		priorityRaw !== "medium" &&
		priorityRaw !== "high"
	) {
		return { ok: false, message: "The --priority option must be low, medium, or high." };
	}

	let limit: number | null = null;
	const limitRaw = readValue(params, "limit");
	if (limitRaw !== undefined) {
		const parsed = Number.parseInt(limitRaw, 10);
		if (!Number.isInteger(parsed) || parsed < 1) {
			return { ok: false, message: "The --limit option must be a positive integer." };
		}
		limit = parsed;
	}

	return {
		ok: true,
		value: {
			status: statusParts as SuggestionCard["status"][],
			kind: (kindRaw as SuggestionCard["kind"] | undefined) ?? null,
			priority: (priorityRaw as SuggestionCard["priority"] | undefined) ?? null,
			limit,
			format: format as "text" | "json"
		}
	};
}

export function parseInboxShowCliArgs(params: CliData): PluginCliParseResult<InboxShowCliInput> {
	const format = readFormat(params);
	const formatErr = assertFormat(format);
	if (formatErr) return formatErr;

	const id = readValue(params, "id");
	if (!id) {
		return { ok: false, message: "The show command requires id=<inbox-id>." };
	}

	return { ok: true, value: { id, format: format as "text" | "json" } };
}

export function parseInboxUpdateCliArgs(
	params: CliData
): PluginCliParseResult<InboxUpdateCliInput> {
	const format = readFormat(params);
	const formatErr = assertFormat(format);
	if (formatErr) return formatErr;

	const id = readValue(params, "id");
	if (!id) {
		return { ok: false, message: "The update command requires id=<inbox-id>." };
	}

	const statusRaw = readValue(params, "status");
	if (
		statusRaw &&
		statusRaw !== "open" &&
		statusRaw !== "snoozed" &&
		statusRaw !== "done" &&
		statusRaw !== "dismissed"
	) {
		return {
			ok: false,
			message: "The --status option must be open, snoozed, done, or dismissed."
		};
	}

	const kindRaw = readValue(params, "kind");
	if (
		kindRaw &&
		kindRaw !== "issue" &&
		kindRaw !== "question" &&
		kindRaw !== "idea" &&
		kindRaw !== "review"
	) {
		return {
			ok: false,
			message: "The --kind option must be issue, question, idea, or review."
		};
	}

	const priorityRaw = readValue(params, "priority");
	if (
		priorityRaw &&
		priorityRaw !== "low" &&
		priorityRaw !== "medium" &&
		priorityRaw !== "high"
	) {
		return { ok: false, message: "The --priority option must be low, medium, or high." };
	}

	const untilRaw = readValue(params, "until");
	if (untilRaw !== undefined) {
		if (statusRaw && statusRaw !== "snoozed") {
			return {
				ok: false,
				message: "The --until option is only valid when status=snoozed."
			};
		}
		if (Number.isNaN(Date.parse(untilRaw))) {
			return {
				ok: false,
				message: "The --until option must be an ISO 8601 date-time string."
			};
		}
	}

	const hasChange =
		statusRaw !== undefined ||
		kindRaw !== undefined ||
		priorityRaw !== undefined ||
		readValue(params, "title") !== undefined ||
		readValue(params, "summary") !== undefined ||
		untilRaw !== undefined;

	if (!hasChange) {
		return {
			ok: false,
			message:
				"The update command requires at least one field to change (status, kind, priority, title, summary, or until)."
		};
	}

	return {
		ok: true,
		value: {
			id,
			status: statusRaw as SuggestionCard["status"] | undefined,
			kind: kindRaw as SuggestionCard["kind"] | undefined,
			priority: priorityRaw as SuggestionCard["priority"] | undefined,
			title: readValue(params, "title"),
			summary: readValue(params, "summary"),
			snoozedUntil: untilRaw,
			format: format as "text" | "json"
		}
	};
}

export function parseInboxDeleteCliArgs(
	params: CliData
): PluginCliParseResult<InboxDeleteCliInput> {
	const id = readValue(params, "id");
	if (!id) {
		return { ok: false, message: "The delete command requires id=<inbox-id>." };
	}

	return { ok: true, value: { id } };
}
