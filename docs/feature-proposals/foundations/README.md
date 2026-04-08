# Implemented Foundations

2026-04-09 に development vault で以下を実地確認した。

- `excli-grep`:
  `TODO` の横断検索、`path` / `exclude-path` / `context` / `stats`、Unicode 固定文字列検索を確認した。
- `excli-apply-patch`:
  `projects/release-checklist.md` に対する `dry-run verbose` と、scratch note への実適用を確認した。
- `excli-render-template`:
  `templates/daily-template.md` の single-file apply と `templates/render-template-e2e` の bundle dry-run を確認した。
- `excli-schema:infer`, `excli-schema:missing`, `excli-schema:validate`:
  project scope の grouped infer、reference scope の missing property 列挙、release checklist の validate を確認した。
- `excli-traverse:reach`, `excli-traverse:path`, `excli-traverse:clusters`:
  `HOME` 起点の到達範囲、`HOME -> projects/active/alpha/meeting-notes` の shortest path、`projects/active/` 内 cluster を確認した。

このディレクトリの文書は「次に実装する proposal」ではなく、他 proposal が依存してよい既存 primitive として扱う。
