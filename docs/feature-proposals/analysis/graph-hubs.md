---
reviewed_at: 2026-04-10
impact: medium
priority_rank: 10
existing_overlap:
    - "excli-traverse:clusters: まとまりは見えるが、中心ノートの順位付けはできない"
    - "links / backlinks: 1-hop 件数は分かるが、vault 全体の hubness は分からない"
    - "manual graph view workflows とは部分重複するが、決定論的な列挙や TSV 出力はできない"
proposal_overlap:
    - "excli-traverse:*: graph snapshot を既存 foundation から共有する"
    - "disambiguate: hub score を link target ranking signal に使える"
    - "serendipity: peripheral node と hub node の組み合わせを novelty scoring に使える"
    - "audit: 極端な dead-end / isolated area の説明補助に使える"
integration:
    needed: true
    decision: "単独コマンドとして維持し、traverse foundation 上に積む graph analytics surface として扱う"
    cluster: graph-analytics
    shared_with:
        - traverse
        - disambiguate
        - serendipity
        - audit
    integrated_proposal: null
builtin_diff_assessment: "妥当。既存の graph browse では『どのノートが中心か』を安定した表形式で返せない。"
recommendation: "中優先度。context / delta の後に、vault 理解を底上げする deterministic graph analytics として導入する。"
---

# Feature proposal: graph-hubs

## 概要

vault のリンクグラフで中心的なノートを列挙するコマンド。入次数、出次数、合算次数、PageRank 風スコアを返し、「この vault のハブはどこか」を決定論的に見られるようにする。

## 動機

`clusters` で graph のまとまりは分かるが、「そのまとまりの中心にあるノートは何か」はまだ分からない。AI が vault を理解するとき、MOC、索引、トピックハブのような中心ノートを先に押さえるだけで探索効率が大きく変わる。

feedback でも、`暗号.md` や `日常.md` のような高次数ノートを知りたい、という要望が明示された。これは `clusters` の派生ではなく、centrality analytics として独立 surface を持つ価値がある。

## コマンド形状

```bash
# 全 vault から hub 上位を返す
obsidian excli-graph:hubs top=20 metric=both format=tsv

# in-degree を重視して列挙する
obsidian excli-graph:hubs top=20 metric=in format=json

# 特定 folder 内だけを見る
obsidian excli-graph:hubs folder=Papers top=10 format=json

# tag scope で中心ノートを出す
obsidian excli-graph:hubs tag=研究 top=15 metric=both format=text
```

## オプション設計

- `top=<n>` — 返す上位件数
- `metric=in|out|both|pagerank` — 主ソートキー
- `folder=<path>` — 対象 subgraph を絞る
- `tag=<tag>` — 対象 subgraph を絞る
- `min-degree=<n>` — 低次数ノードを除外する
- `include-pagerank` — degree 系ソートでも PageRank 列を含める
- `format=json|tsv|text` — 出力形式

## 出力例

### `format=tsv`

```tsv
path	in_degree	out_degree	pagerank_score
暗号.md	42	18	0.091
日常.md	31	27	0.087
PKM.md	24	33	0.081
```

### `format=json`

```json
{
	"metric": "both",
	"nodes": [
		{
			"path": "暗号.md",
			"in_degree": 42,
			"out_degree": 18,
			"pagerank_score": 0.091
		}
	]
}
```

## スコアリング戦略

1. `excli-traverse:*` と同じ graph snapshot を使う
2. `in_degree`, `out_degree`, `both = in + out` を算出する
3. `pagerank` は deterministic な固定反復数で近似する
4. ties は `path` 昇順で安定化する

高度な graph ML は要らない。重要なのは vault 間比較ではなく、同じ vault 内で中心性の高いノートを安定に列挙できることだ。

## 責務分離

- `packages/core` — degree / centrality 計算、ランキング、出力整形
- `packages/plugin` — graph snapshot 収集、folder/tag filter、CLI adapter

## ビルトインとの差分

1-hop の `links` / `backlinks` や `traverse:clusters` では、中心ノートの global ranking は出ない。`graph-hubs` は vault 構造の「どこから読むと効率がよいか」を返す analytics command である。
