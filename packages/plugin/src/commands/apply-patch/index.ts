import type { Plugin } from "obsidian";
import { registerApplyPatchCliHandler } from "./registerCliHandler";

export function registerApplyPatchCommand(plugin: Plugin): void {
	registerApplyPatchCliHandler(plugin);
}
