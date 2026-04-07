# Development Flow

This document is the stable agent-facing reference for the local Obsidian plugin development workflow.
Keep it aligned with the actual container, vault, and workspace setup even if `README.md` changes for broader project documentation.

## Container workflow

Start the development environment with:

```bash
docker compose up -d
```

Install dependencies inside the container with:

```bash
./bin/obsidian-dev pnpm install
```

Run workspace commands inside the container with `./bin/obsidian-dev ...`.
If you enter the Nix dev shell with `nix develop`, the same helper is available as `obsidian-dev`.

## Main development commands

Use these root commands as the default entry points:

```bash
./bin/obsidian-dev pnpm run dev
./bin/obsidian-dev pnpm run build
./bin/obsidian-dev pnpm run lint
./bin/obsidian-dev pnpm run test
```

## Obsidian access

After the container starts, open Obsidian in the browser at <http://localhost:3000>.

The default exposed ports are `3000` and `3001`.
To change them, edit the `ports` section in [`compose.yml`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/compose.yml).

## Vault setup

The development vault is mounted at `/config/vault` inside the container and is backed by [`vault/`](/home/daichi/ghq/github.com/daichi-629/obsidian-simple-plugin-monorepo/vault) in this repository.

During watch runs, the built plugin files are copied to:

```text
vault/.obsidian/plugins/sample-monorepo-plugin/
```

Watch runs also update:

```text
vault/.obsidian/plugins/sample-monorepo-plugin/.hotreload
```

## Workspace layout

```text
packages/
  core/    Shared logic, utilities, and tests
  plugin/  Obsidian plugin entrypoint and build output
vault/     Local development vault
```
