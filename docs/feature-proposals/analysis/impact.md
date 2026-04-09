---
reviewed_at: 2026-04-08
impact: high
priority_rank: 21
existing_overlap:
    - "excli-apply-patch --dry-run: patch 成立性と file-level preview までは見えるが、semantic preflight には届かない"
    - "move with automatic link update とは部分重複するが、孤立化や schema 退行までは見ない"
proposal_overlap:
    - "audit: broken link / embed / schema 系チェックを共有する"
    - "excli-schema:*: coverage regression 判定を共有する"
    - "refactor / workset: destructive operation の preflight として必須"
integration:
    needed: true
    decision: "独立 surface より、mutation 系コマンドから呼ばれる shared preflight layer として扱う"
    cluster: analysis-foundation
    shared_with:
        - excli-apply-patch
        - refactor
        - workset
        - audit
        - schema
    integrated_proposal: docs/feature-proposals/integrated/change-analysis.md
builtin_diff_assessment: "妥当。現行 dry-run との差は明確で、semantic preflight という独自の価値がある。"
recommendation: "source proposal として維持し、canonical 実装順は `integrated/change-analysis.md` を優先する。既存の `excli-apply-patch` dry-run と `excli-schema:*` の分析を共有する preflight layer へ統合する。"
---

# Feature proposal: impact

## 概要

提案された変更が vault に与える意味的な影響範囲を、適用前にシミュレーションして返すコマンド。ファイル差分だけでなく、リンク切れ、埋め込み破損、孤立ノート化、プロパティ整合性の変化までまとめて報告する。

## 動機

AI は変更を作ること自体は得意でも、その変更が vault 全体にどの程度波及するかを見落としやすい。`apply-patch --dry-run` で見えるのはテキスト差分であり、Obsidian 的な意味で何が壊れるかは分からない。

`impact` は「変更を実行するコマンド」ではなく、「変更の危険度を読むコマンド」である。自律エージェントが編集前にこれを叩くことで、壊しやすい変更を避けたり、人間確認が必要な差分だけを拾ったりできる。

## コマンド形状

```bash
# patch を仮適用して影響を調べる
obsidian plugin-impact patch-file=tmp/change.patch format=json

# ノート削除の影響を調べる
obsidian plugin-impact action=delete path=notes/deprecated.md

# ファイル名変更の影響を調べる
obsidian plugin-impact action=rename path=notes/spec.md to=notes/spec-v2.md

# 特定カテゴリの影響だけを見る
obsidian plugin-impact patch-file=tmp/change.patch checks=links,embeds,schema
```

## オプション設計

- `patch=<patch>` — `apply-patch` 互換の差分文字列を直接渡す
- `patch-file=<path>` — 差分ファイルを渡す
- `action=delete|rename|write` — 典型操作を簡易指定するモード
- `path=<path>` — `action` 対象の元ファイル
- `to=<path>` — `rename` の変更先
- `checks=links,embeds,orphans,schema,aliases` — 実行する影響カテゴリ
- `paths-only` — 影響を受けるファイルパスのみ返す
- `max-related=<n>` — 詳細表示する関連ファイル数の上限
- `assume-auto-update-links` — Obsidian の自動リンク更新が走る前提で評価する
- `format=json|text` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Impact summary for patch-file=tmp/change.patch

high
  - 2 unresolved links would be introduced
  - 1 embed would stop resolving

medium
  - 4 files would lose backlinks to notes/spec.md
  - 1 note would become orphaned: notes/legacy-design.md

low
  - property coverage for "status" would drop from 72% to 71%
```

### `format=json`

```json
{
	"risk": "high",
	"summary": {
		"unresolved_links": 2,
		"broken_embeds": 1,
		"orphan_candidates": 1,
		"schema_regressions": 1
	},
	"details": {
		"unresolved_links": [
			{
				"source": "notes/project.md",
				"link": "[[spec-v3]]",
				"line": 14
			}
		],
		"broken_embeds": [
			{
				"source": "notes/moc.md",
				"embed": "![[spec#API]]"
			}
		],
		"orphan_candidates": [{ "path": "notes/legacy-design.md", "backlinks_before": 1 }],
		"schema_regressions": [
			{
				"property": "status",
				"coverage_before": 0.72,
				"coverage_after": 0.71
			}
		]
	}
}
```

## シミュレーション戦略

1. 現在の vault スナップショットをメモリ上に作る
2. `patch` または `action` を仮適用し、変更後テキストを生成する
3. 変更前後でリンク、埋め込み、エイリアス、フロントマターを比較する
4. 差分を危険度付きでまとめる

実ファイルは一切書き換えず、常に in-memory で完結させる。

## 責務分離

- `packages/core` — 仮想ファイル集合への差分適用、変更前後の構造比較、危険度判定、出力整形
- `packages/plugin` — 現在の vault 内容と `MetadataCache` 情報の収集、`action` の解決、CLI adapter

`core` は「前後のテキストとメタデータを比較して何が壊れるかを判定する層」、`plugin` は「現在状態を集める層」に分ける。

## ビルトインとの差分

`apply-patch --dry-run` はパッチ自体の成立性しか見ない。`move` はリンクを自動更新できても、孤立ノート化や埋め込み破損までは報告しない。

`impact` は AI の編集前レビュー用コマンドであり、「書けるか」ではなく「安全に書けるか」を判断するためのものだ。
