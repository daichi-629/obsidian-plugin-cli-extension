import type { Plugin } from "obsidian";
import { registerRenderTemplateCliHandler } from "./registerCliHandler";

export function registerRenderTemplateCommand(plugin: Plugin): void {
	registerRenderTemplateCliHandler(plugin as never);
}
