---
reviewed_at: 2026-04-10
impact: medium
priority_rank: 12
existing_overlap:
    - "tasks command: タスク列挙はできても、構造化 filter や JSON 出力が弱い"
    - "excli-grep: due や tag を近似検索できるが、タスク構造の解釈はできない"
    - "manual Dataview/Tasks query workflows とは部分重複するが、CLI と agent から直接使いにくい"
proposal_overlap:
    - "audit: stale-tasks check と task extractor を共有できる"
    - "block: task line や section addressability を共有できる"
    - "inbox: query 結果を review card に流す producer になれる"
integration:
    needed: true
    decision: "単独 command surface は維持しつつ、snapshot/filter/formatter は analysis-foundation と共有する"
    cluster: analysis-foundation
    shared_with:
        - audit
        - block
        - inbox
    integrated_proposal: docs/feature-proposals/integrated/analysis-foundation.md
builtin_diff_assessment: "妥当。単純な tasks 列挙と、status/due/tag/project を組み合わせた構造化 query は別レイヤである。"
recommendation: "中優先度。audit の stale-task check と同じ extractor を育てつつ、運用 query surface を独立導入できる。"
---

# Feature proposal: tasks-query

## 概要

vault 内のタスクを構造化条件で検索するコマンド。due date、status、tag、project、path などで絞り込み、AI や CLI がそのまま使える JSON を返す。

## 動機

既存の tasks 系 command は「タスクがあること」は分かっても、複数条件を組み合わせて stable に引くには弱い。Dataview や Tasks plugin の条件式に近いことを CLI でやりたい、という要望は自然である。

feedback でも、due-before、tag、project を組み合わせてタスクを取得したいというユースケースが出た。`tasks-query` は vault health のための `audit` とは別に、日常運用でタスク集合を扱う command surface として意味がある。

## コマンド形状

```bash
# 期限が近い重要タスクを返す
obsidian excli-tasks:query due-before=2026-04-15 tag=重要 project=研究室関連 format=json

# 未完了タスクだけを path scope で返す
obsidian excli-tasks:query status=open folder=projects/active format=json

# 完了タスクを除いた path-only 一覧
obsidian excli-tasks:query status=open paths-only

# overdue を text で見る
obsidian excli-tasks:query due-before=today status=open format=text
```

## オプション設計

- `status=open|done|cancelled|any` — タスク状態
- `due-before=<date>` — 期限上限
- `due-after=<date>` — 期限下限
- `tag=<tag>` — task line または note tag で絞る
- `project=<text>` — project property か project-like metadata で絞る
- `folder=<path>` — 対象フォルダ
- `path=<path>` — 単一ノート
- `paths-only` — path と line だけ返す
- `limit=<n>` — 返却件数上限
- `format=json|text|tsv` — 出力形式

## 出力例

### `format=json`

```json
[
	{
		"path": "projects/lab/todo.md",
		"line": 14,
		"text": "PAEKS 実装の benchmark を再実行する",
		"status": "open",
		"due": "2026-04-14",
		"tags": ["重要"],
		"project": "研究室関連"
	}
]
```

### `format=text`

```text
Open tasks due before 2026-04-15

- [ ] PAEKS 実装の benchmark を再実行する
  path: projects/lab/todo.md:14
  due: 2026-04-14
  tags: 重要
```

## クエリ戦略

1. vault から task line を抽出する
2. line-level status、inline metadata、note-level frontmatter を正規化する
3. due / tag / project / scope filter を順に適用する
4. JSON / text / TSV に整形する

query language を最初から一般化しすぎない。まずは deterministic な flag 群で、CLI と agent が安定して呼べることを優先する。

## 責務分離

- `packages/core` — task normalization、filter 適用、sort、formatter
- `packages/plugin` — note 走査、task line 抽出、frontmatter / metadata 解決、CLI adapter

## ビルトインとの差分

既存の tasks 列挙や grep では、「due が来週まで」「tag は重要」「project は研究室関連」のような構造化条件を安定して扱いにくい。`tasks-query` は AI と CLI の両方が再利用できる deterministic task retrieval layer である。
