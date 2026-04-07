---
name: obsidian-plugin-dev
description: Guidance for implementing, refactoring, building, and releasing Obsidian community plugins. Use when work touches Obsidian plugin lifecycle code, `manifest.json`, `versions.json`, publishable plugin assets, hot-reload vault sync, or plugin code split across workspace packages such as `packages/plugin` and `packages/core`.
---

# Obsidian Plugin Dev

Use this skill for reusable Obsidian plugin conventions in a workspace repository. Keep repo-specific workflow details in `AGENTS.md`, and load only the reference files that match the task.

## Workflow

1. Decide whether the task is Obsidian-specific, monorepo-specific, or both.
2. Read `references/obsidian-community-plugin.md` when changing plugin lifecycle code, commands, settings, manifests, release artifacts, or policy-sensitive behavior.
3. Read `references/monorepo-layout.md` when changing package boundaries, workspace scripts, vault sync behavior, build output, or release/version flow in a monorepo.
4. Keep Obsidian API code in the plugin package and move reusable non-Obsidian logic into shared packages.
5. Preserve stable plugin contracts: plugin ID, command IDs, setting keys, and release artifacts.
6. Validate with the relevant root `pnpm` scripts before finishing.

## Reference files

- `references/obsidian-community-plugin.md`
- `references/monorepo-layout.md`
