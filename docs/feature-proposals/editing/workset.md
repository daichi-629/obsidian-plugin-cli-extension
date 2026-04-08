---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 9
existing_overlap:
    - "excli-apply-patch: multi-file 書き戻しは可能だが、single-bundle editing と conflict policy は持たない"
    - "excli-grep: bundle 作成前の対象探索にしか使えない"
proposal_overlap:
    - "context: note bundle 収集を共有する"
    - "impact / change-analysis: apply 前の safety check を共有する"
    - "refactor: multi-file mutation backend を共有できる"
    - "embed-resolve: create 時の read mode に取り込める"
integration:
    needed: true
    decision: "単独コマンドとして維持し、bundle 収集と書き戻し backend を editing-primitives 側で共有する"
    cluster: editing-primitives
    shared_with:
        - context
        - impact
        - change-analysis
        - refactor
        - embed-resolve
    integrated_proposal: null
builtin_diff_assessment: "概ね妥当。read-only bundle と low-level patch の間にある round-trip 編集面として独自性がある。"
recommendation: "中盤候補。既存の `excli-apply-patch` を書き戻し backend に使い、context と change-analysis の基盤が整ってから着手する。"
---

# Feature proposal: workset

## 概要

複数ノートを 1 つの編集用バンドルに束ねてエクスポートし、編集後にそのバンドルを vault へ安全に書き戻すコマンド。AI が複数ファイルをまたぐ作業をするとき、単一の大きなテキストとして扱えるようにする。

## 動機

AI は単一ペイロードの中で整合的に編集するのは得意だが、10 個のノートを別々に `read` / `apply-patch` する往復は苦手である。特に「仕様ノートと計画ノートと日報を同時に更新する」ような作業では、途中で文脈を落としたり、一部だけ更新して整合性を崩したりしやすい。

`workset` は vault の一部を AI 向けの一時ワークスペースに変換する。読む段階では 1 つのファイルに束ね、書く段階では元の複数ファイルへ分解して戻す。人間の手動操作よりも、エージェントの round-trip 編集に最適化された発想である。

## コマンド形状

```bash
# 関連ノート群を 1 つの bundle に書き出す
obsidian plugin-workset create seed=notes/project.md depth=1 out=tmp/project.workset.md

# 明示したノート群だけで bundle を作る
obsidian plugin-workset create paths=notes/spec.md,notes/plan.md,notes/qa.md format=json

# 編集済み bundle を vault に反映する
obsidian plugin-workset apply workset=tmp/project.workset.md

# 競合があれば拒否し、反映前に dry-run する
obsidian plugin-workset apply workset=tmp/project.workset.md conflict=reject dry-run
```

## オプション設計

### `workset create`

- `seed=<path>` — 起点ノート
- `paths=<path,path,...>` — 明示対象ノート一覧
- `depth=<n>` — `seed` からリンクを辿る深さ（デフォルト: 1）
- `direction=out|in|both` — 収集方向（デフォルト: `both`）
- `max-files=<n>` — 収集上限
- `out=<path>` — 出力ファイル
- `format=markdown|json` — バンドル形式（デフォルト: `markdown`）

### `workset apply`

- `workset=<path>` — 編集済み bundle ファイル（必須）
- `conflict=reject|mark|overwrite` — 元ノート更新との競合時の挙動
- `dry-run` — 実際には書き戻さず結果だけ表示
- `allow-create` — bundle 内の新規ファイル作成を許可する

## バンドル形式

### `format=markdown`

```markdown
---
workset: project-alpha
created_at: 2026-04-08T10:00:00Z
files:
    - path: notes/project.md
      mtime: 2026-04-08T09:55:00Z
      hash: 4df7...
    - path: notes/spec.md
      mtime: 2026-04-08T09:30:00Z
      hash: a91c...
---

<!-- file: notes/project.md -->

# Project

...

<!-- end file -->

<!-- file: notes/spec.md -->

# Spec

...

<!-- end file -->
```

## 出力例

### `apply dry-run`

```text
Workset apply: tmp/project.workset.md

  update: notes/project.md
  update: notes/spec.md
  create: notes/release-checklist.md

Conflicts: 1
  - notes/spec.md changed after workset creation
```

### `format=json`

```json
{
	"workset": "project-alpha",
	"files": [
		{
			"path": "notes/project.md",
			"status": "update",
			"conflict": false
		},
		{
			"path": "notes/spec.md",
			"status": "update",
			"conflict": true,
			"reason": "mtime changed since bundle creation"
		},
		{
			"path": "notes/release-checklist.md",
			"status": "create",
			"conflict": false
		}
	]
}
```

## 書き戻し戦略

1. bundle 内の各ファイル断片をパースする
2. 作成時に記録した `mtime` と `hash` で元ファイルの変化を検出する
3. 競合がなければ各断片を個別ファイルへ戻す
4. 競合がある場合は `conflict` 方針に従って拒否・注記・上書きを選ぶ

これにより AI は単一文書を編集しつつ、vault 側では楽観的排他制御つきの multi-file 更新として扱える。

## 責務分離

- `packages/core` — bundle のシリアライズ / デシリアライズ、差分判定、競合解決ポリシー、出力整形
- `packages/plugin` — workset 対象ノートの収集、ファイル読み書き、`mtime` / hash 取得、CLI adapter

`core` は bundle 形式の仕様と round-trip ロジックを持ち、`plugin` は vault との接続面だけを担当する。

## ビルトインとの差分

`context` が実現するとしてもそれは読み取り専用であり、`apply-patch` は低レベルな差分適用であって、複数ノートを 1 つの編集単位として扱う概念を持たない。

`workset` は「AI にとって編集しやすい形へ vault を一時変換し、あとで安全に戻す」という round-trip そのものを機能として持つ点で独自である。
