import { type CliData, type CliHandler, Plugin } from "obsidian";
import { buildGreeting } from "@sample/core";

export function registerCliHandlers(plugin: Plugin): void {
	const handler: CliHandler = (params: CliData) => {
		const name = params.name === "true" || !params.name ? "CLI" : params.name;
		const greeting = buildGreeting({ name });
		return `sample-monorepo-plugin executed successfully.\n${greeting}`;
	};

	plugin.registerCliHandler(
		"sample-monorepo-plugin",
		"Print a greeting from the sample monorepo plugin.",
		null,
		handler
	);
}
