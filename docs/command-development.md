# Command Development Guide

This document is a practical guide for adding or changing commands in this repository.

For the technical design background, see [`docs/design/command-spec-co-location.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/design/command-spec-co-location.md).
This guide focuses only on two practical questions for day-to-day development: where each piece of information belongs, and what you need to do when adding a new command.

## Basic Policy

In this repository, the user-facing specification for each command is managed in that command's `spec.ts`.

- The source of truth is `packages/plugin/src/commands/<command-name>/spec.ts`
- `spec.ts` contains the command name, summary, usage, main options, examples, and notes
- Implementation-specific concerns and design rationale notes belong in `docs/design/`

In other words, if a change affects how a command is used, you should assume that `spec.ts` needs to be updated first.

## How It Differs From `docs/design`

This does not make `docs/design/` unnecessary.
The roles are simply separated.

- `packages/plugin/src/commands/<command-name>/spec.ts`
  - The specification that describes how the command is used
  - Something updated alongside the implementation
  - Content intended to be referenced from the CLI
- `docs/design/<command-name>-design.md`
  - The design background
  - Why the specification was chosen
  - Notes on future extensions and constraints

If you are unsure, put anything about how users interact with the command in `spec.ts`, and put design discussion or background explanation in `docs/design/`.

## What To Do When Adding a Command

When adding a new command, work in this order:

1. Write `docs/design/<command-name>-design.md` if needed
2. Create `packages/plugin/src/commands/<command-name>/spec.ts`
3. Implement the command logic
4. Add any necessary tests
5. Set up the command directory on the plugin side
6. Register it in `packages/plugin/src/commands/index.ts`

This order helps you define the user-facing shape of the command before getting into implementation.

## Files To Touch When Adding One

At minimum, check the following locations:

- `packages/plugin/src/commands/<command-name>/spec.ts`
- `packages/plugin/src/commands/<command-name>/`
- `packages/plugin/src/commands/index.ts`

If you need shared logic, move it into `packages/core` and add the corresponding tests there as well.

## How To Think About Changes

The same approach applies when changing an existing command.

- If the usage changes, update `spec.ts` too
- If the change is implementation-only, do not force an edit to `spec.ts`
- If the background explanation becomes long, move it into `docs/design/`

It is useful to ask, "Did the implementation change without changing the specification?" That makes diffs easier to reason about.

## What To Check In Review

For command-related changes, start by checking these points:

- Whether `spec.ts` matches the change
- Whether the implementation in the command directory is consistent with `spec.ts`
- Whether the command registration is reflected in `packages/plugin/src/commands/index.ts`

Only follow into `docs/design/` when you need to confirm the design intent as well.

## Summary

In this repository, command specifications are not kept only in `docs/design/`. They are managed close to the command implementation.

When adding a new command, define the user-facing specification in `spec.ts` first, then proceed with implementation, tests, and registration.
