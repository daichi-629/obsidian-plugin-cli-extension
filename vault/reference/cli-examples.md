# CLI examples

## Grep command

```bash
obsidian sample-monorepo-plugin-grep pattern=TODO
obsidian sample-monorepo-plugin-grep pattern=todo ignore-case line-number
obsidian sample-monorepo-plugin-grep pattern=grep path=projects/
```

## Expected behavior

- `TODO` should match uppercase items only.
- `todo` with `ignore-case` should also match lowercase lines.
- `grep` should appear in this note and in project notes.
