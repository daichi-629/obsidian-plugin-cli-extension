# Monorepo layout reference

## Workspace shape

- The workspace uses `pnpm` with packages under `packages/*`.
- `packages/plugin` contains the Obsidian-facing plugin package and publishable assets.
- `packages/core` contains shared logic that should remain independent from the Obsidian runtime.
- `vault/` is the local development vault used for testing.

## Development workflow

- Run commands from the repository root.
- Use `pnpm run dev`, `pnpm run build`, `pnpm run lint`, and `pnpm run test` as the default entry points.
- The Docker-based workflow in `docs/development-flow.md` uses `./bin/obsidian-dev ...` to run commands inside the container.
- Open Obsidian in the browser on `http://localhost:3000` when using the provided container setup.

## Package boundaries

- Keep Obsidian lifecycle code, manifests, and publishable assets in `packages/plugin`.
- Move reusable domain logic, utilities, and tests into `packages/core`.
- Do not import the Obsidian API into `packages/core`.
- If logic can be tested without Obsidian, prefer `packages/core`.

## Build and vault sync

- `packages/plugin/esbuild.config.mjs` bundles `packages/plugin/src/main.ts` into `packages/plugin/main.js`.
- Build output is copied into `vault/.obsidian/plugins/<plugin-id>/`.
- Watch mode also updates `vault/.obsidian/plugins/<plugin-id>/.hotreload`.
- The current plugin ID comes from `packages/plugin/manifest.json`.
- The build script also ensures the `hot-reload` plugin exists in the local vault.

## Versioning and release flow

- Root version commands are `pnpm run version:patch`, `pnpm run version:minor`, and `pnpm run version:major`.
- Keep `packages/plugin/manifest.json` and `packages/plugin/versions.json` in sync.
- Release tags must exactly match the plugin version.
- The release workflow uploads `packages/plugin/main.js`, `packages/plugin/manifest.json`, and `packages/plugin/styles.css`.

## Practical checks

- When changing plugin packaging, verify the copied files under `vault/.obsidian/plugins/<plugin-id>/`.
- When changing shared logic, run the relevant tests for `packages/core`.
- When changing release metadata, inspect both the root scripts and the plugin package files that they update.
