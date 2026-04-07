# Obsidian plugin monorepo

## First read

- This repository is a pnpm monorepo for Obsidian plugin development.
- Use [`docs/development-flow.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/docs/development-flow.md) as the source of truth for the Docker-based workflow, ports, and local vault setup.
- For reusable Obsidian plugin guidance, load the local skill at [`.codex/skills/obsidian-plugin-dev/SKILL.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/.codex/skills/obsidian-plugin-dev/SKILL.md) and then read only the references you need.

## Repository layout

- `packages/plugin`: Obsidian plugin package. Contains `src/main.ts`, `manifest.json`, `versions.json`, `styles.css`, `esbuild.config.mjs`, and the bundled `main.js`.
- `packages/core`: Shared logic that should stay independent from the Obsidian API.
- `vault/`: Local development vault. Watch builds copy the publishable plugin files into `vault/.obsidian/plugins/sample-monorepo-plugin/`.

## Working rules

- Run workspace commands from the repository root with `pnpm`.
- Prefer the root scripts: `pnpm run dev`, `pnpm run build`, `pnpm run lint`, and `pnpm run test`.
- When the containerized workflow matters, use `./bin/obsidian-dev ...` as described in [`docs/development-flow.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/docs/development-flow.md).
- Keep `packages/plugin/src/main.ts` focused on plugin lifecycle and registration. Move reusable or non-Obsidian logic into `packages/core` or focused modules under `packages/plugin/src/`.
- Do not add Obsidian API dependencies to `packages/core`.
- Keep plugin IDs, command IDs, and persisted setting keys stable unless the user explicitly asks to change them.
- When changing release metadata, keep `packages/plugin/manifest.json` and `packages/plugin/versions.json` aligned.
- Respect the build pipeline in `packages/plugin/esbuild.config.mjs`. Dev/watch runs copy `main.js`, `manifest.json`, and `styles.css` into the vault plugin directory and update `.hotreload`.

## Validation

- For plugin behavior or build changes, run `pnpm run build` or `pnpm run dev`.
- For shared logic changes, run the relevant tests through `pnpm run test`.
- If the task changes versioning or release flow, verify `packages/plugin/manifest.json` and `packages/plugin/versions.json` together.
