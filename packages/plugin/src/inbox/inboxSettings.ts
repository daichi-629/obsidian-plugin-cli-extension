export type InboxSettings = {
	dismissCooldownDays: number;
};

export const DEFAULT_INBOX_SETTINGS: InboxSettings = {
	dismissCooldownDays: 7
};

export function resolveInboxSettings(raw: unknown): InboxSettings {
	if (typeof raw !== "object" || raw === null) {
		return { ...DEFAULT_INBOX_SETTINGS };
	}

	const obj = raw as Record<string, unknown>;
	const cooldown = obj["dismissCooldownDays"];

	return {
		dismissCooldownDays:
			typeof cooldown === "number" && Number.isInteger(cooldown) && cooldown >= 1
				? cooldown
				: DEFAULT_INBOX_SETTINGS.dismissCooldownDays
	};
}
