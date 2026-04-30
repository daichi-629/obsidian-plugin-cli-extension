---
reviewed_at: 2026-04-10
impact: high
priority_rank: 2
existing_overlap:
    - "single-file read: 個別 path の取得はできるが、複数ノートを 1 回で返せない"
    - "excli-grep: 候補発見には使えるが、本文や frontmatter の一括取得はできない"
    - "manual read loops とは部分重複するが、agent の往復回数は減らせない"
proposal_overlap:
    - "context: seed から集めたノート束の取得 backend として共有する"
    - "embed-resolve: bulk read の read mode として組み合わせられる"
    - "workset: create 時の明示 path 群の fetcher を共有できる"
integration:
    needed: true
    decision: "単独 command surface は維持し、context-engine の最下層 bulk fetch primitive として実装する"
    cluster: context-engine
    shared_with:
        - context
        - embed-resolve
        - workset
    integrated_proposal: docs/feature-proposals/integrated/context-engine.md
builtin_diff_assessment: "妥当。既存の read を複数回呼ぶ運用とは別に、AI 向けの char-budgeted bulk fetch という独立した価値がある。"
recommendation: "feedback 直結の最優先 concrete proposal。context-engine の stage 0 として先に入れる。"
---

# Feature proposal: read-bulk

## 概要

複数ノートを 1 回の command でまとめて取得するコマンド。明示 path 群、folder、tag などで対象を決め、本文と frontmatter を文字数予算つきで返す。

`context` が graph-aware bundle 生成を担うのに対し、`read-bulk` は「対象が既に決まっている複数ノートをどう効率よく読むか」を担う。

## 動機

AI が vault を読むときの最大のボトルネックは、必要なノート数だけ `read` を繰り返す round trip である。候補探索は `grep` や `traverse` でできても、その後の実データ取得が 1 ファイルずつではすぐに遅くなる。

feedback でも、「シードから周辺ノートを読む前に、まず複数ノートを一括で読めること」が最優先要件として現れた。`read-bulk` は高レベルな ranking や traversal を持たず、まず読み出しの throughput を改善する。

## コマンド形状

```bash
# 明示した複数ノートを一括取得する
obsidian excli-read:bulk paths=Papers/foo.md,Papers/bar.md format=json

# tag で絞って文字数上限内に収める
obsidian excli-read:bulk tag=暗号 max-char=8000 format=json

# folder 配下を frontmatter 付きで返す
obsidian excli-read:bulk folder=Papers include-frontmatter format=json

# path 一覧だけ先に決め、本文は markdown bundle として返す
obsidian excli-read:bulk paths=notes/spec.md,notes/plan.md format=markdown
```

## オプション設計

- `paths=<path,path,...>` — 明示対象ノート一覧
- `folder=<path>` — 対象フォルダ
- `tag=<tag>` — 対象タグ
- `max-files=<n>` — 返すノート数の上限
- `max-char=<n>` — 文字数上限
- `include-frontmatter` — frontmatter を構造化して含める
- `resolve-embeds` — `embed-resolve` 相当の展開を組み合わせる
- `sort=path|mtime|size` — 返却順の安定化ルール
- `format=json|markdown|tsv` — 出力形式

`paths` と `folder` / `tag` は排他的に扱う。`folder` と `tag` は AND 条件で組み合わせてよい。

## 出力例

### `format=json`

```json
{
	"truncated": false,
	"notes": [
		{
			"path": "Papers/foo.md",
			"frontmatter": {
				"tags": ["crypto"],
				"status": "reading"
			},
			"content": "# Foo\n\n..."
		},
		{
			"path": "Papers/bar.md",
			"frontmatter": {
				"tags": ["crypto"]
			},
			"content": "# Bar\n\n..."
		}
	]
}
```

### `format=markdown`

```markdown
<!-- read-bulk truncated=false -->

## Papers/foo.md

# Foo

...

## Papers/bar.md

# Bar

...
```

## 取得戦略

1. `paths` または `folder` / `tag` から対象ノート集合を決める
2. 指定順または `sort` で順序を安定化する
3. 必要なら frontmatter を抽出する
4. `max-char` を超えた時点で deterministic に打ち切る
5. `resolve-embeds` 指定時だけ `embed-resolve` の展開器を通す

文字数ベースで deterministic に打ち切れることを優先する。

## 責務分離

- `packages/core` — char budget、並び順、truncation、出力整形
- `packages/plugin` — path / folder / tag によるファイル収集、本文読出し、frontmatter 抽出、CLI adapter

## ビルトインとの差分

single-file `read` は 1 ノートずつしか返せない。`grep` は候補発見には使えても、本文と frontmatter をまとめて返さない。`read-bulk` は「複数ノートの内容を 1 round trip で読む」こと自体を first-class にするコマンドである。
