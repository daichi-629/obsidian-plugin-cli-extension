---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 19
existing_overlap:
    - "grep: 時系列 reconstruction はできない"
    - "apply-patch: 無関係"
    - "manual timeline reconstruction workflows とは部分重複する"
proposal_overlap:
    - "delta: 時刻シグナルを共有できる"
    - "evidence / claims: event citation の候補生成を共有する"
    - "tension: 分岐や未解決論点の抽出を共有する"
    - "context: ソースノート収集を共有する"
integration:
    needed: true
    decision: "単独コマンドとして維持し、context-engine と claim-analysis の上位整形層として扱う"
    cluster: context-engine
    shared_with:
        - delta
        - evidence
        - claims
        - tension
        - context
    integrated_proposal: docs/feature-proposals/integrated/context-engine.md
builtin_diff_assessment: "妥当。検索結果や changed file list からは narrative は直接得られない。"
recommendation: "優先度は低め。面白いが解釈依存が強く、他の structured analysis が揃ってからの方が品質を出しやすい。"
---

# Feature proposal: narrative

## 概要

散在したノート断片から、あるテーマ・プロジェクト・人物についての「時系列の物語線」を再構成して返すコマンド。日付、リンク、更新履歴、語彙の連続性を手掛かりに、出来事の流れと分岐点を引用付きで返す。

## 動機

vault における重要な情報は、単一ノートではなく daily ノート、会議メモ、仕様ノート、ふりかえりノートに分散していることが多い。AI が現状を理解したいとき、必要なのはファイル一覧や検索ヒットではなく「何がどう進んだか」という時間方向の構造である。

`delta` は変更されたファイルを返すが、意味的な出来事の流れは組み立てない。`context` は関連ノート群を束ねるが、時間順序を保証しない。`evidence` は問いに対する根拠を返すが、経緯そのものは語らない。

`narrative` は vault を読むための CLI ではなく、vault から「経緯」を抽出する CLI である。解釈と再構成を含むため公式は持ち込みにくいが、AI が状況把握するうえでは非常に価値が高い。

## コマンド形状

```bash
# あるテーマについて最近 90 日の経緯を時系列で返す
obsidian plugin-narrative query="project X" window=90d format=markdown

# 起点ノート周辺から、daily と meeting を優先して物語線を組む
obsidian plugin-narrative seed=notes/project-x.md include=daily,meetings top=12

# 特定インシデントの経緯と分岐点を JSON で返す
obsidian plugin-narrative path=incidents/2026-04-outage.md branches format=json

# ある人物が関わるイベントだけを追う
obsidian plugin-narrative query="採用プロセス" actor="田中" since=2026-01-01
```

## オプション設計

- `path=<path>` — 対象ノートを明示する
- `seed=<path>` — 周辺ノートを辿る起点ノート
- `query=<text>` — 物語線を構成する主題
- `actor=<text>` — 特定人物や役割を含むイベントを優先する
- `window=<duration>` — 直近何日分を見るか（例: `30d`, `90d`）
- `since=<timestamp>` — 物語線の開始時刻
- `until=<timestamp>` — 物語線の終了時刻
- `include=daily,meetings,notes,attachments` — 収集対象の種類
- `top=<n>` — 返すイベント数の上限
- `branches` — 本流だけでなく分岐した議論や代替案も返す
- `require-citations` — 出典位置が曖昧なイベントを除外する
- `format=text|markdown|json` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Narrative for: "project X"

1. 2026-02-03 daily/2026-02-03.md#^kickoff
   プロジェクト X が初めてキックオフされた

2. 2026-02-10 notes/project-x.md#^requirements
   要件として「オフライン閲覧対応」が固定された

3. 2026-02-18 meetings/2026-02-18.md#^api-choice
   API 方針が REST 案と GraphQL 案に分岐した
   branch: technical-decision

4. 2026-02-25 notes/roadmap.md#^milestone
   5 月末リリースがマイルストーンとして明記された

5. 2026-03-01 daily/2026-03-01.md#^blocker
   認証実装が主要ブロッカーとして記録された

uncertain
  - 2026-02-12 notes/ideas.md#^mobile
    モバイル同時対応の案があるが、採択は確認できない
```

### `format=json`

```json
{
	"query": "project X",
	"timeline": [
		{
			"time": "2026-02-03",
			"path": "daily/2026-02-03.md",
			"block_id": "kickoff",
			"event": "プロジェクト X が初めてキックオフされた",
			"kind": "start",
			"confidence": 0.93
		},
		{
			"time": "2026-02-18",
			"path": "meetings/2026-02-18.md",
			"block_id": "api-choice",
			"event": "API 方針が REST 案と GraphQL 案に分岐した",
			"kind": "decision-branch",
			"branch": "technical-decision",
			"confidence": 0.87
		}
	],
	"uncertain": [
		{
			"path": "notes/ideas.md",
			"block_id": "mobile",
			"event": "モバイル同時対応の案があるが採択は未確認",
			"confidence": 0.42
		}
	]
}
```

## 再構成戦略

1. `path` / `seed` / `query` から候補ノートを集める
2. frontmatter の日付、daily ノートのファイル名、本文中の日付表現、`mtime` を統合して時刻シグナルを抽出する
3. 「決定」「延期」「開始」「完了」「検討」などの語彙からイベント候補をブロック単位で抜き出す
4. リンク、参照語、共通エンティティを使って同一ストーリー上のイベントをつなぐ
5. 時系列に並べつつ、並行して進んだ論点は `branch` として分岐表示する
6. 時刻や因果が曖昧なものは `uncertain` に分離する

ここで返す narrative は歴史の唯一の正解ではなく、AI が状況を理解するための高信頼な暫定再構成と位置付ける。

## 責務分離

- `packages/core` — 日付正規化、イベント抽出、時系列整列、branch 推定、確信度付け、出力整形
- `packages/plugin` — vault からの候補ノート収集、frontmatter / `MetadataCache` / `mtime` の取得、ブロック位置解決、CLI adapter

`core` はノート断片とメタデータだけを入力にし、Obsidian API に依存しない再構成ロジックとして保つ。

## ビルトインとの差分

`search` や `grep` は一致箇所を返すが経緯を返さない。`delta` は変更ファイルの差分であり、意味的な出来事の流れではない。`context` は関連資料束であって時系列のストーリーではない。

`narrative` は vault の断片を「読む」ための補助ではなく、「経緯として再構成する」ためのコマンドである点が根本的に異なる。
