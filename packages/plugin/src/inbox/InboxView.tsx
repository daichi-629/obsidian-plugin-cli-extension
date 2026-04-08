import { ItemView, type WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InboxViewComponent } from "./InboxViewComponent";
import type { InboxSettings } from "./inboxSettings";
import type { InboxStoreManager } from "./InboxStoreManager";

export const INBOX_VIEW_TYPE = "excli-inbox-view";

export class InboxView extends ItemView {
	private readonly store: InboxStoreManager;
	private readonly settings: InboxSettings;
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf, store: InboxStoreManager, settings: InboxSettings) {
		super(leaf);
		this.store = store;
		this.settings = settings;
	}

	getViewType(): string {
		return INBOX_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Inbox";
	}

	getIcon(): string {
		return "inbox";
	}

	async onOpen(): Promise<void> {
		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<InboxViewComponent
					store={this.store}
					settings={this.settings}
					app={this.app}
					component={this}
				/>
			</StrictMode>
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
