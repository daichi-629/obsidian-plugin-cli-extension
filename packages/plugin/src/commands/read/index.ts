import type { Plugin } from "obsidian";
import { registerReadBulkCliHandler } from "./registerCliHandler";

export function registerReadCommand(plugin: Plugin): void {
	registerReadBulkCliHandler(plugin);
}
