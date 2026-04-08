import type { Plugin } from "obsidian";
import { registerTraverseCliHandlers } from "./registerCliHandler";

export function registerTraverseCommand(plugin: Plugin): void {
	registerTraverseCliHandlers(plugin);
}
