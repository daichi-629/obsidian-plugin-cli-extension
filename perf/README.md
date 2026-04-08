# Agent Benchmark Fixtures

This directory stores tracked benchmark definitions for the synthetic vault benchmark harness.

## Layout

- `scenarios/` contains tracked task definitions.
- `schema/` contains JSON Schema files for scenario metadata and agent final responses.
- `prompts/` stores generated prompts at runtime and is gitignored.
- `results/` stores runtime artifacts and is gitignored.

## Workflow

Run the benchmark from the repository root.

```bash
pnpm run perf:run -- --agent codex --scenario 'search-*' --profile large
pnpm run perf:run -- --agent claude --scenario 'operate-*' --profile large
pnpm run perf:summary -- --input perf/results/<timestamp>
```

The harness rebuilds the plugin, regenerates the base vault, adds a deterministic synthetic corpus under `vault/perf-generated/`, runs the selected agent, and then verifies the final JSON answer plus the resulting vault diff.
