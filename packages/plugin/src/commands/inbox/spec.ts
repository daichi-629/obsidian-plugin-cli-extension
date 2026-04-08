import type { CommandSpec } from "../../shared/cli/types";

export const inboxCreateCommandSpec: CommandSpec = {
	name: "excli-inbox:create",
	summary: "Add a suggestion card to the inbox.",
	synopsis: [
		"obsidian excli-inbox:create kind=<issue|question|idea|review> title=<text> [summary=<text>] [related=<path[,path...]>] [priority=<low|medium|high>] [source=<text>] [fingerprint=<text>] [format=<text|json>]"
	],
	description: [
		"Creates a new SuggestionCard and appends it to the inbox store.",
		"If a card with the same fingerprint already exists and is open or snoozed, the existing card is updated (seenCount +1) and its id is returned instead of creating a duplicate."
	],
	options: [
		{
			key: "kind",
			value: "<issue|question|idea|review>",
			description: "Card type.",
			required: true
		},
		{
			key: "title",
			value: "<text>",
			description: "Short title shown in list view.",
			required: true
		},
		{ key: "summary", value: "<text>", description: "Full-text body of the card." },
		{
			key: "related",
			value: "<path[,path...]>",
			description: "Comma-separated vault-relative paths of related notes."
		},
		{
			key: "priority",
			value: "<low|medium|high>",
			description: "Card priority. Default: medium."
		},
		{
			key: "source",
			value: "<text>",
			description: "Label identifying the producer. Default: cli."
		},
		{
			key: "fingerprint",
			value: "<text>",
			description: "Deduplication key. Auto-generated from source and title if omitted."
		},
		{ key: "format", value: "<text|json>", description: "Output format. Default: text." }
	],
	notes: [
		"Duplicate detection only suppresses cards whose status is open or snoozed. Cards with status done are recreated. Cards with status dismissed are suppressed during the dismissCooldownDays window."
	],
	seeAlso: ["excli-inbox:list", "excli-inbox:show", "excli-inbox:update", "excli-inbox:delete"]
};

export const inboxListCommandSpec: CommandSpec = {
	name: "excli-inbox:list",
	summary: "List inbox cards with optional filtering.",
	synopsis: [
		"obsidian excli-inbox:list [status=<open|snoozed|done|dismissed[,...]>] [kind=<issue|question|idea|review>] [priority=<low|medium|high>] [limit=<n>] [format=<text|json>]"
	],
	description: [
		"Returns a filtered and sorted list of cards.",
		"Default filter is status=open,snoozed. Sort order is priority descending (high > medium > low), then createdAt ascending."
	],
	options: [
		{
			key: "status",
			value: "<open|snoozed|done|dismissed[,...]>",
			description: "Comma-separated status filter. Default: open,snoozed."
		},
		{ key: "kind", value: "<issue|question|idea|review>", description: "Filter by card kind." },
		{ key: "priority", value: "<low|medium|high>", description: "Filter by priority." },
		{ key: "limit", value: "<n>", description: "Maximum number of cards to return." },
		{ key: "format", value: "<text|json>", description: "Output format. Default: text." }
	],
	seeAlso: ["excli-inbox:create", "excli-inbox:show", "excli-inbox:update", "excli-inbox:delete"]
};

export const inboxShowCommandSpec: CommandSpec = {
	name: "excli-inbox:show",
	summary: "Show details of a single inbox card.",
	synopsis: ["obsidian excli-inbox:show id=<inbox-id> [format=<text|json>]"],
	description: [
		"Returns all fields of the specified card. Exits with code 4 if the id is not found."
	],
	options: [
		{ key: "id", value: "<inbox-id>", description: "Card ID.", required: true },
		{ key: "format", value: "<text|json>", description: "Output format. Default: text." }
	],
	seeAlso: ["excli-inbox:list", "excli-inbox:update"]
};

export const inboxUpdateCommandSpec: CommandSpec = {
	name: "excli-inbox:update",
	summary: "Update fields of an existing inbox card.",
	synopsis: [
		"obsidian excli-inbox:update id=<inbox-id> [status=<open|snoozed|done|dismissed>] [kind=<issue|question|idea|review>] [priority=<low|medium|high>] [title=<text>] [summary=<text>] [until=<iso8601>] [format=<text|json>]"
	],
	description: [
		"Patches the specified card with the provided fields. updatedAt is always refreshed.",
		"until is only valid when status=snoozed or when the card is already snoozed."
	],
	options: [
		{ key: "id", value: "<inbox-id>", description: "Card ID.", required: true },
		{ key: "status", value: "<open|snoozed|done|dismissed>", description: "New status." },
		{ key: "kind", value: "<issue|question|idea|review>", description: "New kind." },
		{ key: "priority", value: "<low|medium|high>", description: "New priority." },
		{ key: "title", value: "<text>", description: "New title." },
		{ key: "summary", value: "<text>", description: "New summary." },
		{
			key: "until",
			value: "<iso8601>",
			description: "Snooze expiry time. Requires status=snoozed or current status snoozed."
		},
		{ key: "format", value: "<text|json>", description: "Output format. Default: text." }
	],
	seeAlso: ["excli-inbox:show", "excli-inbox:delete"]
};

export const inboxDeleteCommandSpec: CommandSpec = {
	name: "excli-inbox:delete",
	summary: "Permanently delete an inbox card.",
	synopsis: ["obsidian excli-inbox:delete id=<inbox-id>"],
	description: ["Removes the card from the store immediately. No confirmation is printed."],
	options: [{ key: "id", value: "<inbox-id>", description: "Card ID.", required: true }],
	seeAlso: ["excli-inbox:update"]
};
