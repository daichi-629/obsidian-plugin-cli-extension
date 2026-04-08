import type { Plugin } from "obsidian";
import { registerApplyPatchCommand } from "./apply-patch";
import { registerGrepCommand } from "./grep";
import { registerRenderTemplateCommand } from "./render-template";
import { registerSchemaCommand } from "./schema";

export function registerCommands(plugin: Plugin): void {
	registerApplyPatchCommand(plugin);
	registerGrepCommand(plugin);
	registerRenderTemplateCommand(plugin);
	registerSchemaCommand(plugin);
}
