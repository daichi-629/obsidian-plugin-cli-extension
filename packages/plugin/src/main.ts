import { Plugin } from "obsidian";
import { registerCommands } from "./commands";

export default class SampleMonorepoPlugin extends Plugin {
	async onload() {
		registerCommands(this);
	}
}
