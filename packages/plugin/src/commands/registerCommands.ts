import { Notice, Plugin } from "obsidian";
import { buildGreeting } from "@sample/core";

export function registerCommands(plugin: Plugin): void {
	const message = buildGreeting({ name: "Obsidian" });

	plugin.addCommand({
		id: "sample-monorepo-greeting",
		name: "Show greeting",
		callback: () => new Notice(message)
	});
}
