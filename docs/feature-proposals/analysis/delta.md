---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 11
existing_overlap:
    - "grep: 差分ではなく現時点の文字列検索しかできない"
    - "apply-patch: patch 操作の結果は作れるが、vault 全体の時系列変化は追えない"
proposal_overlap:
    - "narrative: 時刻シグナルを共有できる"
    - "inbox: change review card の生成元になれる"
    - "audit: modified files を監査対象へ絞る最適化に使える"
integration:
    needed: true
    decision: "単独コマンドは維持しつつ、snapshot diff と graph diff は analysis-foundation に寄せる"
    cluster: analysis-foundation
    shared_with:
        - narrative
        - inbox
        - audit
    integrated_proposal: docs/feature-proposals/integrated/analysis-foundation.md
builtin_diff_assessment: "modified file 列挙の差分は明確だが、delete 検出が session buffer 前提なので唯一の履歴源にはしない方がよい。"
recommendation: "analysis-foundation 後の中盤候補。継続セッション向けに絞って導入する。"
---

# Feature proposal: delta

## 概要

vault の変更履歴を時刻ベースで問い合わせるコマンド。「いつ以降に何が変わったか」を構造化して返し、AI が vault の増分状態を把握できるようにする。

## 動機

AI が vault を継続的に参照するセッションでは、「前回読んだ後に何が変わったか」を知ることが重要になる。現状では vault 全体を再スキャンするか、個別ファイルの `mtime` を比較するしかない。

`delta` は Obsidian の `vault.getFiles()` と `stat().mtime` を活用して差分を集約し、AI が「何を読み直すべきか」を O(1) で判断できる入力を提供する。ファイルシステムレベルの変更だけでなく、リンクグラフへの影響（新しいリンクが生まれたか、切れたか）も報告できる。

## コマンド形状

```bash
# 過去24時間の変更を列挙する
obsidian plugin-delta since=24h format=json

# 特定の ISO 8601 タイムスタンプ以降の変更
obsidian plugin-delta since=2026-04-07T09:00:00 format=tsv

# 変更されたファイルのパスだけを返す（AI のコンテキスト再読み込み用）
obsidian plugin-delta since=1h paths-only

# タグでフィルタ（変更されたノートのうち特定タグを持つものだけ）
obsidian plugin-delta since=7d tag=project format=json

# リンクグラフへの影響も含める
obsidian plugin-delta since=24h graph-impact format=json
```

## オプション設計

- `since=<duration|timestamp>` — 基準時刻（必須）。`1h` / `24h` / `7d` の相対表記、または ISO 8601 の絶対時刻
- `tag=<tag>` — 変更ノートをタグで絞り込む
- `folder=<path>` — 変更ノートをフォルダで絞り込む
- `paths-only` — ファイルパスのみをリスト表示（詳細なし）
- `graph-impact` — 追加・削除されたリンクエッジを報告する
- `limit=<n>` — 返す件数の上限（デフォルト: 無制限）
- `format=json|tsv|text` — 出力形式（デフォルト: `text`）

## 出力例

### デフォルト（`format=text`）

```text
Delta since 24h ago (2026-04-07 10:00:00)
  created:  2 files
  modified: 5 files
  deleted:  1 file
```

### `format=json`

```json
{
	"since": "2026-04-07T10:00:00.000Z",
	"created": [{ "path": "notes/new-idea.md", "mtime": "2026-04-08T08:12:00.000Z" }],
	"modified": [
		{
			"path": "notes/project.md",
			"mtime": "2026-04-08T09:45:00.000Z",
			"wordcount_delta": 120
		},
		{
			"path": "daily/2026-04-08.md",
			"mtime": "2026-04-08T07:30:00.000Z",
			"wordcount_delta": 45
		}
	],
	"deleted": [{ "path": "notes/old-draft.md", "deleted_at": "2026-04-08T08:00:00.000Z" }]
}
```

### `graph-impact` 付き

```json
{
	"since": "2026-04-07T10:00:00.000Z",
	"graph_impact": {
		"links_added": [{ "from": "notes/new-idea.md", "to": "notes/project.md" }],
		"links_removed": [{ "from": "notes/old-draft.md", "to": "notes/requirements.md" }],
		"new_unresolved": ["notes/missing-ref.md"]
	}
}
```

### `paths-only`

```text
notes/new-idea.md
notes/project.md
daily/2026-04-08.md
```

## `since` パラメータの解釈

| 入力例                 | 解釈                           |
| ---------------------- | ------------------------------ |
| `1h`                   | 現在から1時間前                |
| `24h`                  | 現在から24時間前               |
| `7d`                   | 現在から7日前                  |
| `2026-04-07T09:00:00`  | ローカルタイムゾーンの絶対時刻 |
| `2026-04-07T09:00:00Z` | UTC の絶対時刻                 |

削除ファイルの検出は `mtime` では追えないため、Obsidian の `vault.on('delete', ...)` イベントをセッション中にバッファリングする。バッファは揮発性（プラグインリロードでリセット）であることを出力に明記する。

## 責務分離

- `packages/core` — 相対時間パース（`1h` → `Date`）、変更エントリの型定義、グラフ影響の差分計算、出力整形
- `packages/plugin` — `vault.getFiles()` + `stat().mtime` によるファイルスキャン、削除イベントバッファ、`MetadataCache` を使ったリンクスナップショット比較、CLI adapter

## ビルトインとの差分

`sync:status` は Obsidian Sync の同期状態を返すが、vault の内容変化ではない。`patches` はパッチ操作の記録であり、vault の変更履歴ではない。

`delta` は「vault の時系列変化」という概念を CLI に持ち込む唯一のコマンドであり、AI が状態変化をインクリメンタルに追跡するためのプリミティブとなる。
