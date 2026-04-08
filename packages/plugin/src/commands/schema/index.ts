import type { Plugin } from "obsidian";
import { registerSchemaCliHandlers } from "./registerCliHandler";

export function registerSchemaCommand(plugin: Plugin): void {
	registerSchemaCliHandlers(plugin);
}
