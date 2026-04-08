import { UserError, type VaultSchemaNote, type VaultSchemaSnapshot } from "@sample/core";

function normalizeVaultPath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

function normalizeFolder(folder: string | undefined): string | null {
	if (folder === undefined) {
		return null;
	}

	const normalized = normalizeVaultPath(folder);
	return normalized.length === 0 ? "" : normalized;
}

export function normalizeSchemaTag(tag: string | undefined): string | null {
	if (tag === undefined) {
		return null;
	}

	const normalized = tag.replace(/^#+/, "").trim();
	return normalized.length === 0 ? null : normalized;
}

function matchesFolder(note: VaultSchemaNote, folder: string | null): boolean {
	if (folder === null) {
		return true;
	}

	if (folder === "") {
		return true;
	}

	return note.path === folder || note.path.startsWith(`${folder}/`);
}

function matchesTag(note: VaultSchemaNote, tag: string | null): boolean {
	return tag === null || note.tags.includes(tag);
}

export function filterVaultSchemaSnapshot(
	snapshot: VaultSchemaSnapshot,
	input: { folder?: string; tag?: string }
): {
	scope: { folder: string | null; tag: string | null; noteCount: number };
	snapshot: VaultSchemaSnapshot;
} {
	const folder = normalizeFolder(input.folder);
	const tag = normalizeSchemaTag(input.tag);
	const notes = snapshot.notes.filter(
		(note) => matchesFolder(note, folder) && matchesTag(note, tag)
	);
	return {
		scope: {
			folder,
			tag,
			noteCount: notes.length
		},
		snapshot: {
			propertyCatalog: snapshot.propertyCatalog,
			notes
		}
	};
}

export function resolveSchemaTargetNotes(
	snapshot: VaultSchemaSnapshot,
	paths: string[]
): VaultSchemaNote[] {
	const deduped = [...new Set(paths.map((path) => normalizeVaultPath(path)))];
	const resolved = deduped
		.map((path) => {
			const note = snapshot.notes.find((entry) => entry.path === path);
			if (!note) {
				throw new UserError(`Markdown note not found: ${path}`);
			}

			return note;
		})
		.sort((left, right) => left.path.localeCompare(right.path));

	return resolved;
}
