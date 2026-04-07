import type { Plugin } from "obsidian";
import { registerGrepCommand } from "./grep";

export function registerCommands(plugin: Plugin): void {
	registerGrepCommand(plugin);
}
