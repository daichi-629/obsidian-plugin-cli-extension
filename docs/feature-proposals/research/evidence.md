---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 17
existing_overlap:
    - "excli-grep: 候補断片の取得には使えるが、supports / contradicts / related の分類はない"
    - "apply-patch: 根拠収集とは無関係"
    - "manual search-and-compare workflows とは部分重複する"
proposal_overlap:
    - "tension: claim extraction と conflict 判定の前段を共有する"
    - "narrative: citation 付き event 抽出の候補生成を共有できる"
    - "context: 関連ノート収集を共有する"
integration:
    needed: true
    decision: "単独コマンドは維持し、claim-analysis の前半 surface として実装する"
    cluster: claim-analysis
    shared_with:
        - tension
        - narrative
        - context
    integrated_proposal: docs/feature-proposals/research/claims.md
builtin_diff_assessment: "概ね妥当。検索とグラウンディング束の生成は別レイヤである。"
recommendation: "source proposal として維持し、canonical 実装順は `claims` を優先する。block citation と retrieval 基盤の後に着手する。"
---

# Feature proposal: evidence

## 概要

質問・主張・作業方針に対して、vault 内の根拠を「支持」「反証」「関連だが未確定」に分けて返すコマンド。AI がノートを読んで答えたり編集したりする前に、引用可能な証拠束を 1 回で取得できるようにする。

## 動機

AI に vault を使わせるときの失敗は、情報不足よりも「それっぽいが根拠の弱い判断」をしてしまうことにある。現状の `read`、`grep`、`search` 系コマンドでは、根拠候補の断片は拾えても、それが問いに対して支持なのか反証なのかを整理した形では返ってこない。

`evidence` は AI の思考の前段に置くためのコマンドである。まず証拠を束ね、その後に AI が結論を出す。人間向けの検索というより、エージェント向けのグラウンディング層に近い。

## コマンド形状

```bash
# 質問に対する根拠束を返す
obsidian plugin-evidence question="project X の締切はいつか" top=6 format=json

# 主張に対する支持・反証を両方集める
obsidian plugin-evidence claim="この vault では daily ノートに frontmatter は不要" include=contradicts top=8

# 特定ノート文脈から見た証拠を優先する
obsidian plugin-evidence question="次に何を実装するべきか" context-path=notes/project.md tag=project

# ファイルに書かれた作業方針に対する根拠を収集する
obsidian plugin-evidence claim-file=tmp/plan.txt scope=blocks format=markdown
```

## オプション設計

- `question=<text>` — 質問文を入力するモード
- `claim=<text>` — 真偽や妥当性を検証したい主張
- `claim-file=<path>` — 長い主張や方針文をファイルから読み込む
- `context-path=<path>` — そのノートから近い証拠を優先する
- `scope=blocks|sections|notes` — 証拠の返却単位（デフォルト: `blocks`）
- `include=supports,contradicts,related` — 返すカテゴリ（デフォルト: 全て）
- `tag=<tag>` — 対象ノートをタグで絞る
- `folder=<path>` — 対象ノートをフォルダで絞る
- `top=<n>` — 各カテゴリの最大件数
- `require-citations` — 引用位置が特定できない候補を除外する
- `format=json|markdown|text` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Evidence for: "project X の締切はいつか"

supports
  1. notes/project.md#^due-date
     "締切は 2026-05-31 とする"
  2. daily/2026-04-07.md#^planning
     "project X は 5 月末リリース予定"

contradicts
  1. notes/roadmap.md#^milestone
     "project X の最終期限は 2026-06-15"

related
  1. notes/release-checklist.md#^schedule
     "project X の QA は 5 月第 4 週"
```

### `format=json`

```json
{
	"query": "project X の締切はいつか",
	"supports": [
		{
			"path": "notes/project.md",
			"block_id": "due-date",
			"line": 18,
			"excerpt": "締切は 2026-05-31 とする",
			"score": 0.93,
			"signals": ["exact-date", "title-match", "context-proximity"]
		}
	],
	"contradicts": [
		{
			"path": "notes/roadmap.md",
			"block_id": "milestone",
			"line": 42,
			"excerpt": "project X の最終期限は 2026-06-15",
			"score": 0.71,
			"signals": ["date-conflict", "shared-entity"]
		}
	],
	"related": [
		{
			"path": "notes/release-checklist.md",
			"block_id": "schedule",
			"line": 9,
			"excerpt": "project X の QA は 5 月第 4 週",
			"score": 0.48
		}
	]
}
```

## スコアリング戦略

1. まず `grep` 相当の文字列一致とエイリアス一致で候補ブロックを拾う
2. `MetadataCache` のリンク情報から `context-path` 近傍を加点する
3. 否定語・日付差分・状態語（`done` / `cancelled` など）を使って支持 / 反証を粗く分類する
4. スコア順に並べ、分類に自信が低いものは `related` に落とす

ここでの分類は最終判断ではなく、AI が読む順序を最適化するための前処理と位置付ける。

## 責務分離

- `packages/core` — クエリ正規化、候補スコアリング、支持 / 反証 / 関連の分類、出力整形
- `packages/plugin` — vault 内テキスト断片の収集、`MetadataCache` を使ったリンク近傍情報の取得、ブロック ID と行番号の解決、CLI adapter

`core` はテキスト断片とメタデータだけを受け取り、Obsidian API を知らない純粋ロジックとして保つ。

## ビルトインとの差分

`grep` や `search` は一致箇所を返すが、「この問いに対して根拠としてどう使えそうか」を整理しない。`context` は関連ノート群を組み立てるが、支持と反証の区別は持たない。

`evidence` は AI が結論を出す前に根拠を先に集めるためのコマンドであり、検索ではなくグラウンディングのためのプリミティブである。
