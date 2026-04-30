---
type: readme
tags:
  - docs
  - fixture
status: active
---

# Sample vault

This vault is intentionally populated for local plugin development and command testing.

Run `pnpm run vault:generate` from the repository root to refresh the generated fixtures.

## Areas

- `HOME.md` is a map-of-content note that links the main fixtures together.
- `daily/` keeps daily notes with realistic tasks and links.
- `tasks/` and `queries/` cover Tasks/Dataview-style content.
- `projects/` keeps active and archived work with mixed note sizes.
- `reference/` keeps grep-oriented fixtures and tricky formatting cases.
- `read-bulk-e2e/` keeps multi-note read and embed-resolution fixtures.
- `meeting-notes/` and `people/` add more realistic cross-linked notes.
- `collisions/` and `deep/` cover path ambiguity and deep nesting.
- `stress/` keeps larger files for traversal and output-limit checks.
- `templates/private/` keeps intentionally denied content for policy checks.
- `attachments/bulk/` provides a noisier attachment set.
- `.obsidian/` includes config fixtures that grep must continue to ignore.

## Schema hints

- Most operational notes now expose frontmatter such as `type`, `tags`, `status`, and `date`.
- Some notes intentionally omit frontmatter so `excli-schema:missing` and validation flows still have realistic failures to report.
- A few notes intentionally keep unusual or low-frequency properties such as `created` or `rogue_key`.

## Search hints

- Search `TODO` to verify default matching across many files.
- Search `incident` within `projects/archive/` to verify path filters.
- Search `EDGECASE_` inside `reference/long-lines.md` to test long single-line handling.
- Search `Japanese` or `検索` to spot Unicode handling.
- Open `reference/code-fence-lab.md` for explicit fenced code samples.
- Open `HOME.md` in Obsidian to navigate the generated vault like a real workspace.
