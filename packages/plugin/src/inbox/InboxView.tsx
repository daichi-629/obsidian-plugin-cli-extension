import { ItemView, type WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InboxFocusViewComponent } from "./InboxFocusViewComponent";
import { InboxViewComponent } from "./InboxViewComponent";
import type { InboxSettings } from "./inboxSettings";
import type { InboxStoreManager } from "./InboxStoreManager";

export const INBOX_FOCUS_VIEW_TYPE = "excli-inbox-focus-view";
export const INBOX_LIST_VIEW_TYPE = "excli-inbox-list-view";

class BaseInboxView extends ItemView {
	protected readonly store: InboxStoreManager;
	protected readonly settings: InboxSettings;
	protected root: Root | null = null;

	constructor(leaf: WorkspaceLeaf, store: InboxStoreManager, settings: InboxSettings) {
		super(leaf);
		this.store = store;
		this.settings = settings;
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}

export class InboxFocusView extends BaseInboxView {
	getViewType(): string {
		return INBOX_FOCUS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Inbox focus";
	}

	getIcon(): string {
		return "inbox";
	}

	async onOpen(): Promise<void> {
		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<InboxFocusViewComponent
					store={this.store}
					settings={this.settings}
					app={this.app}
					component={this}
				/>
			</StrictMode>
		);
	}
}

export class InboxListView extends BaseInboxView {
	getViewType(): string {
		return INBOX_LIST_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Inbox list";
	}

	getIcon(): string {
		return "table";
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
}
