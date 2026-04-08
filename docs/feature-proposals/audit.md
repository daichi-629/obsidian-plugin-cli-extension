---
reviewed_at: 2026-04-08
impact: high
priority_rank: 6
existing_overlap:
  - "grep: 空ノートや期限語の一部は近似検索できるが、網羅監査や severity 付けはできない"
  - "apply-patch: 修正はできるが監査機能はない"
  - "Obsidian の orphan/dead-end/unresolved 系チェックとは部分重複する"
proposal_overlap:
  - "schema: high-coverage property 欠落チェックを内包する"
  - "impact: broken link / embed / schema 系チェック実装を共有できる"
  - "inbox: issue card の主要生成元になる"
integration:
  needed: true
  decision: "単独レポート surface は維持し、check engine だけ shared analysis foundation に寄せる"
  cluster: analysis-foundation
  shared_with:
    - schema
    - impact
    - inbox
  integrated_proposal: docs/feature-proposals/integrated/analysis-foundation.md
builtin_diff_assessment: "概ね妥当。個別コマンドの束を優先度付きレポートへ統合する価値はある。"
recommendation: "schema と impact の共通 analyzer を整えた後に段階導入する。"
---

# Feature proposal: audit

## 概要

vault 全体を多角的に検査し、品質問題・構造的な不整合・メンテナンスが必要な箇所を一括で報告するコマンド。個別のコマンド（`orphans`, `deadends`, `unresolved`）を別々に叩く代わりに、AI が vault の健全性を一度のコマンドで把握できる。

## 動機

Obsidian の既存コマンドは個別の問題を個別に検出する。AI が vault のメンテナンスを行うには、まず「何が問題か」を網羅的に把握する必要があるが、現状では `orphans` → `deadends` → `unresolved` → `tasks` → `properties` を順に叩き、結果を手動で統合しなければならない。

`audit` はこれらを一括実行して優先度付きのレポートを返す。AI はレポートを受け取ってから、対処すべき問題を選んで `refactor`, `apply-patch`, `delete` などのコマンドで修正するというワークフローが成立する。

## コマンド形状

```bash
# vault 全体の品質監査を実行する
obsidian plugin-audit format=json

# 特定カテゴリのチェックだけを実行する
obsidian plugin-audit checks=orphans,deadends,schema format=json

# 深刻度が high 以上の問題だけを表示する
obsidian plugin-audit severity=high format=text

# 特定フォルダを対象にする
obsidian plugin-audit folder=notes format=json

# 問題のファイルパスだけを返す（他コマンドへのパイプ用）
obsidian plugin-audit checks=orphans paths-only
```

## チェック項目

| ID                  | 内容                                                       | デフォルト深刻度 |
| ------------------- | ---------------------------------------------------------- | ---------------- |
| `orphans`           | どこからもリンクされていないノート                         | medium           |
| `deadends`          | リンクが外に出ていかないノート（ハブでないのに行き止まり） | low              |
| `unresolved`        | 存在しないノートへのリンク                                 | high             |
| `broken-embeds`     | 存在しないファイルへのトランスクルージョン                 | high             |
| `schema`            | 高カバレッジプロパティが欠落しているノート                 | medium           |
| `empty`             | 本文が空のノート（フロントマターのみ含む）                 | low              |
| `stale-tasks`       | 期限（`due` プロパティ）が過去日のタスク                   | medium           |
| `large-notes`       | 単一ノートが閾値を超えるワード数を持つ（分割候補）         | low              |
| `duplicate-aliases` | 複数ノートが同じエイリアスを持つ（曖昧参照の原因）         | high             |

## オプション設計

- `checks=<list>` — 実行するチェック ID のカンマ区切りリスト（省略時: 全チェック）
- `folder=<path>` — 対象フォルダを絞り込む
- `tag=<tag>` — 対象ノートをタグで絞り込む
- `severity=low|medium|high` — 指定深刻度以上の問題だけを表示
- `paths-only` — 問題のあるファイルパスだけをリスト表示
- `limit=<n>` — 各チェックで報告する問題数の上限
- `format=json|text` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Vault audit: 248 notes checked

  [high]   unresolved       12 notes have unresolved links
  [high]   duplicate-aliases 2 aliases conflict: "ML" (notes/ml.md, notes/ml-old.md)
  [medium] orphans          18 notes have no backlinks
  [medium] schema           31 notes missing 'tags' (coverage: 98%)
  [medium] stale-tasks       4 tasks past due date
  [low]    empty             5 notes have no body content
  [low]    large-notes       3 notes exceed 2000 words

Total: 75 issues across 7 checks
```

### `format=json`

```json
{
	"checked": 248,
	"summary": {
		"high": 14,
		"medium": 53,
		"low": 8
	},
	"results": [
		{
			"check": "unresolved",
			"severity": "high",
			"count": 12,
			"items": [
				{
					"source": "notes/project.md",
					"link": "[[missing-spec]]",
					"line": 14
				}
			]
		},
		{
			"check": "duplicate-aliases",
			"severity": "high",
			"count": 1,
			"items": [
				{
					"alias": "ML",
					"files": ["notes/ml.md", "notes/ml-old.md"]
				}
			]
		},
		{
			"check": "orphans",
			"severity": "medium",
			"count": 18,
			"items": [{ "path": "notes/random-thought.md" }, { "path": "notes/unused-draft.md" }]
		},
		{
			"check": "schema",
			"severity": "medium",
			"count": 31,
			"detail": "missing property 'tags' (vault coverage: 98%)",
			"items": [{ "path": "notes/quick-note.md" }]
		}
	]
}
```

## `stale-tasks` の判定ロジック

1. `tasks` コマンド相当で未完了タスクを全取得する
2. 各タスクを含むノートのフロントマター `due` プロパティを参照する
3. `due` が現在日時より過去の場合を stale と判定する
4. `due` を持たないタスクは対象外とする

## 責務分離

- `packages/core` — 各チェックの判定ロジック・スコアリング、結果のマージと深刻度ソート、`paths-only` / JSON / text 出力整形
- `packages/plugin` — 各チェックに必要な vault データの収集（`MetadataCache`, `vault.getFiles()`, `getAllPropertyInfos()`）、CLI adapter

個々のチェックを独立した関数として `packages/core` に実装し、`packages/plugin` はデータを渡すだけにする。これにより将来的なチェック追加が `core` の変更だけで完結する。

## ビルトインとの差分

`orphans`, `deadends`, `unresolved` はそれぞれ1種類の問題だけを返す独立したコマンドである。`audit` はこれらに加え、スキーマ整合性・空ノート・期限切れタスク・重複エイリアスといったビルトインがカバーしない問題も検出し、優先度付きで統合されたレポートを返す。
AI がアクションを起こす前の「vault の現状把握」を1コマンドで完了させることが `audit` の核心的な役割である。
