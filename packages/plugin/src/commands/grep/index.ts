import type { Plugin } from "obsidian";
import { registerGrepCliHandler } from "./registerCliHandler";

export function registerGrepCommand(plugin: Plugin): void {
	registerGrepCliHandler(plugin);
}
