# Obsidian Sample Monorepo Plugin

Obsidian plugin development environment with Docker included.

`docker compose up -d` gives you a ready-to-use setup with:

- Obsidian
- Obsidian CLI
- Node.js
- pnpm
- hot reload

You do not need to install Obsidian, Node.js, or pnpm on your host machine.
Clone the repository, start Docker, and the environment is ready.

After the container starts, open Obsidian in your browser at <http://localhost:3000>.

## What you get

- A default monorepo structure for Obsidian plugin development
- `packages/plugin` for the actual Obsidian plugin
- `packages/core` for reusable logic that stays independent from Obsidian
- A local vault in `./vault` for development and testing
- Automatic plugin publishing into the vault plugin directory
- Hot reload support during `pnpm run dev`

## Quick start

Start the environment:

```bash
docker compose up -d
```

Install dependencies inside the container:

```bash
./bin/obsidian-dev pnpm install
```

Start the plugin watcher:

```bash
./bin/obsidian-dev pnpm run dev
```

This is enough to start developing.

## Obsidian CLI

The container includes the `obsidian` command.

Example:

```bash
./bin/obsidian-dev obsidian help
```

## Vault and ports

The development vault is mounted at `/config/vault` inside the container and is backed by [`./vault`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/vault) in this repository.

The default exposed ports are `3000` and `3001`. To change them, edit the `ports` section in [`compose.yml`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/compose.yml).

## Monorepo layout

```text
packages/
  core/    Shared logic, utilities, and tests
  plugin/  Obsidian plugin entrypoint and build output
vault/     Local development vault
```

This layout gives you a clean default split between plugin-specific code and reusable application logic.

## Development

Inside the container, the main commands are:

```bash
./bin/obsidian-dev pnpm run dev
./bin/obsidian-dev pnpm run build
./bin/obsidian-dev pnpm run lint
./bin/obsidian-dev pnpm run test
```

If you enter the Nix dev shell with `nix develop`, the helper is also available on your `PATH` as `obsidian-dev`.

During watch runs, the built plugin files are copied to:

```text
vault/.obsidian/plugins/sample-monorepo-plugin/
```

Hot reload is prepared automatically, and watch runs also update:

```text
vault/.obsidian/plugins/sample-monorepo-plugin/.hotreload
```

## Releasing

1. Bump the version with one of:
   `pnpm run version:patch`, `pnpm run version:minor`, or `pnpm run version:major`
2. Review and commit the updated version files
3. Push the commit to `main`
4. Create a tag that exactly matches `packages/plugin/manifest.json`'s `version`
5. Push the tag to GitHub

The release workflow runs on tag pushes matching `*.*.*` and verifies that:

- the tag exactly matches `packages/plugin/manifest.json`'s `version`
- `packages/plugin/versions.json` contains the same version

If validation passes, GitHub Actions builds the plugin and uploads:

- `packages/plugin/main.js`
- `packages/plugin/manifest.json`
- `packages/plugin/styles.css`

## Acknowledgements

This template repository was developed starting from the
[`obsidian-sample-plugin`](https://github.com/obsidianmd/obsidian-sample-plugin).

## Third-party container base

The development container defined in
[`Dockerfile.obsidian`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/Dockerfile.obsidian)
is based on [`linuxserver/obsidian`](https://github.com/linuxserver/docker-obsidian).

Please refer to the upstream project for its license and redistribution terms
when building or distributing the container image.
The Obsidian plugin source code in this repository is separate from that
container image.
