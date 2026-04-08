export type SuggestionCard = {
	id: string;
	status: "open" | "snoozed" | "done" | "dismissed";
	kind: "issue" | "question" | "idea" | "review";
	priority: "low" | "medium" | "high";
	title: string;
	summary: string;
	source: {
		command: string;
		runAt: string; // ISO 8601
	};
	relatedPaths: string[];
	evidence?: Array<{
		path: string;
		blockId?: string;
		excerpt?: string;
	}>;
	suggestedActions?: Array<{
		label: string;
		action: "open-note" | "open-search" | "create-task" | "run-followup";
		payload?: Record<string, string>;
	}>;
	fingerprint: string;
	seenCount: number;
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
	snoozedUntil?: string; // ISO 8601, status=snoozed のときのみ
	dismissedAt?: string; // ISO 8601, status=dismissed のときのみ
};

export type InboxCreateResult =
	| {
			created: true;
			card: SuggestionCard;
	  }
	| {
			created: false;
			reason: "duplicate_open" | "duplicate_dismissed_cooldown";
			card: SuggestionCard;
	  };

export type InboxCardSummary = {
	id: string;
	status: string;
	kind: string;
	priority: string;
	title: string;
	createdAt: string;
	seenCount: number;
};

export type InboxListResult = {
	filter: {
		status: ("open" | "snoozed" | "done" | "dismissed")[];
		kind: string | null;
		priority: string | null;
		limit: number | null;
	};
	totalCount: number;
	displayedCount: number;
	cards: InboxCardSummary[];
};

export type InboxOutputFormat = "text" | "json";
