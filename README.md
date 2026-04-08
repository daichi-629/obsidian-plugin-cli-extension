# excli

`excli` is an Obsidian plugin for vault operations that work well from the Obsidian CLI and local automation.

It adds script-friendly commands for searching notes, applying patches, rendering templates, inspecting frontmatter schema, traversing the link graph, and managing an inbox of suggestions. It also adds two Obsidian views for browsing inbox cards inside the app.

Developer workflow notes from the previous README now live in [`docs/develop-docs/README.md`](docs/develop-docs/README.md).

## What excli can do

- Search vault files with grep-style output modes
- Apply Codex-compatible patches to vault files
- Render note templates or template bundles into the vault
- Infer and validate frontmatter/property schema from existing notes
- Traverse links, shortest paths, and clusters in the note graph
- Store suggestion cards in an inbox that can be reviewed in Obsidian or over CLI

## Main features

### Grep for automation

`excli-grep` is meant for scripts and agents that need more control than Obsidian's built-in search.

```bash
obsidian excli-grep pattern=TODO
obsidian excli-grep pattern=TODO path=daily/ line-number
obsidian excli-grep pattern=TODO files-with-matches
obsidian excli-grep pattern='^todo' ignore-case max-results=5 json
```

The command supports regular expressions, fixed-string mode, include and exclude path filters, context lines, counts, JSON output, and scan statistics.

### Safe vault edits

`excli-apply-patch` applies a Codex `apply_patch` document through Obsidian's vault adapter instead of writing around Obsidian.

```bash
obsidian excli-apply-patch patch-file=tmp/change.patch dry-run
obsidian excli-apply-patch patch-file=vault:tmp/change.patch allow-create verbose
```

Use `dry-run` to validate a patch before writing. `allow-create` is required for new files.

### Template rendering

`excli-render-template` turns template files or bundles into notes.

```bash
obsidian excli-render-template template=daily-template.md destination='daily/<%= it._system.date %>.md'
obsidian excli-render-template template=project-scaffold destination='projects/atlas' data='{"title":"Atlas"}'
```

You can preview output without writing, merge JSON data files, and choose how existing files are handled.

### Schema inspection

The schema commands help you understand and enforce frontmatter conventions.

```bash
obsidian excli-schema:infer folder=projects/ format=text
obsidian excli-schema:missing key=status folder=projects/
obsidian excli-schema:validate path=projects/atlas.md folder=projects/ fail-on=high
```

### Graph traversal

The traverse commands inspect connections between notes.

```bash
obsidian excli-traverse:reach from=HOME depth=2
obsidian excli-traverse:path from=HOME to=projects/atlas
obsidian excli-traverse:clusters folder=projects/ min-size=3
```

### Inbox for suggestions

`excli` includes an inbox system for suggestions, issues, ideas, and review tasks.

- Ribbon action: open inbox focus view
- Ribbon action: open inbox list view
- Command palette: `Open inbox focus view`
- Command palette: `Open inbox list view`
- CLI: create, list, show, update, and delete inbox cards

Examples:

```bash
obsidian excli-inbox:create kind=idea title="Split long note" related=projects/atlas.md
obsidian excli-inbox:list status=open,snoozed format=json
obsidian excli-inbox:update id=<inbox-id> status=done
```

## Settings

Open **Settings -> Community plugins -> excli** to configure:

- Grep path restrictions and target file extensions
- Template root, denied output paths, and render limits
- Inbox dismiss cooldown for deduplication

The plugin defaults to local vault behavior. There are no required external services.

## Command help

Every CLI command exposes a built-in manual:

```bash
obsidian excli-grep man
obsidian excli-render-template man
obsidian excli-inbox:create man
```

## Installation

If you are installing manually, create `.obsidian/plugins/excli/` in your vault and place these files there:

- `main.js`
- `manifest.json`
- `styles.css`

Then enable **excli** from **Settings -> Community plugins**.

## Notes

- `grep` automatically excludes Obsidian's config directory.
- Grep and template output policies are enforced from plugin settings.
- Commands are designed for local vault automation, so output formats favor scripting and agent workflows.
