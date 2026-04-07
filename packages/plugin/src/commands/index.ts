import type { Plugin } from "obsidian";
import { registerApplyPatchCommand } from "./apply-patch";
import { registerGrepCommand } from "./grep";

export function registerCommands(plugin: Plugin): void {
	registerApplyPatchCommand(plugin);
	registerGrepCommand(plugin);
}
