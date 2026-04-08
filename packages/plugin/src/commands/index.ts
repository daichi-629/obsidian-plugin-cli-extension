import type { Plugin } from "obsidian";
import type { InboxSettings } from "../inbox/inboxSettings";
import { registerApplyPatchCommand } from "./apply-patch";
import { registerGrepCommand } from "./grep";
import { registerInboxCommand } from "./inbox";
import { registerRenderTemplateCommand } from "./render-template";
import { registerSchemaCommand } from "./schema";
import { registerTraverseCommand } from "./traverse";

export function registerCommands(
	plugin: Plugin,
	inboxSettings: InboxSettings
): ReturnType<typeof registerInboxCommand> {
	registerApplyPatchCommand(plugin);
	registerGrepCommand(plugin);
	registerRenderTemplateCommand(plugin);
	registerSchemaCommand(plugin);
	registerTraverseCommand(plugin);
	return registerInboxCommand(plugin, inboxSettings);
}
