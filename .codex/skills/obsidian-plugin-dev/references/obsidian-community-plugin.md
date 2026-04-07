# Obsidian community plugin reference

## Project contract

- Target an Obsidian Community Plugin built from TypeScript into a bundled `main.js`.
- Release artifacts are `main.js`, `manifest.json`, and optional `styles.css`.
- Keep the plugin lightweight and browser-compatible unless desktop-only behavior is intentional.

## Source layout

- Keep plugin lifecycle code small and focused.
- Split feature logic into separate modules instead of growing `main.ts`.
- Use clear boundaries for commands, settings, UI, utilities, and types.

## Commands and settings

- Register user-facing actions with `this.addCommand(...)`.
- Keep command IDs stable after release.
- Provide sensible defaults for settings.
- Persist settings with `await this.loadData()` and `await this.saveData()`.
- Re-render or refresh UI after settings changes when needed.

## Lifecycle and cleanup

- Use `this.registerEvent(...)`, `this.registerDomEvent(...)`, and `this.registerInterval(...)` for anything that needs cleanup on unload.
- Write idempotent load paths so plugin reloads do not leak listeners or intervals.
- Keep startup light and defer expensive work until it is needed.

## Manifest and release metadata

- `manifest.json` must include a stable `id`, semantic `version`, `minAppVersion`, `description`, and `isDesktopOnly`.
- Keep `minAppVersion` accurate for the APIs in use.
- Never change `id` after release.
- Update `versions.json` when you bump the plugin version.
- Release tags should exactly match the plugin version without a leading `v`.

## Security and privacy

- Default to local/offline behavior.
- Add network calls only when they are essential to the feature and clearly disclosed.
- Never fetch and execute remote code.
- Avoid collecting or transmitting vault contents unless it is essential and explicitly consented.
- Document external services, analytics, or data flow in both settings copy and `README.md`.

## UX and copy

- Use sentence case for UI labels and headings.
- Keep in-app text short, direct, and action-oriented.
- Prefer **Settings → Community plugins** style navigation text.
- Avoid jargon and keep command names clear.

## Performance and compatibility

- Avoid long-running work during `onload`.
- Batch disk access and avoid unnecessary vault-wide scans.
- Debounce or throttle expensive file-system reactions.
- Avoid Node/Electron-only APIs unless `isDesktopOnly` is `true`.
- Stay mindful of memory and storage limits for mobile clients.

## Manual verification

- Build the plugin and make sure the release artifacts are present where the repo expects them.
- Reload Obsidian after updating plugin files.
- Confirm commands appear after `onload`.
- Confirm settings persist across reloads.

## Useful references

- Obsidian sample plugin: <https://github.com/obsidianmd/obsidian-sample-plugin>
- API documentation: <https://docs.obsidian.md>
- Developer policies: <https://docs.obsidian.md/Developer+policies>
- Plugin guidelines: <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- Style guide: <https://help.obsidian.md/style-guide>
