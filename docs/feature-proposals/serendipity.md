---
reviewed_at: 2026-04-08
impact: low
priority_rank: 16
existing_overlap:
  - "grep: 候補調査の材料にはなるが、新しい接続提案や novelty scoring はできない"
  - "manual graph browsing workflows とは部分重複する"
proposal_overlap:
  - "disambiguate: ranking / keyword / graph-distance signals を共有する"
  - "traverse: graph distance の計算を共有する"
  - "inbox: suggestion card の有力な供給元"
integration:
  needed: true
  decision: "単独コマンドとして維持し、link-intelligence の exploratory surface として後置する"
  cluster: link-intelligence
  shared_with:
    - disambiguate
    - traverse
    - inbox
  integrated_proposal: null
builtin_diff_assessment: "妥当。既存探索系とは『存在しない辺を提案する』点で目的が異なる。"
recommendation: "最後に回す。差別化要素ではあるが、主観性が高く deterministic core の後がよい。"
---

# Feature proposal: serendipity

## 概要

まだリンクされていないノート同士のうち、意外だが有用そうな接続候補を提案するコマンド。共通語彙、似た構造、並行する問題設定、相補的な視点を手掛かりに、「この 2 つをつなぐと発見がある」という越境リンクを返す。

## 動機

Obsidian の価値は既に存在するリンクだけではなく、「まだ結ばれていないが結ぶと知識が進む組み合わせ」にもある。しかし人間は既知の文脈に引っ張られやすく、vault が大きくなるほど遠い領域同士の接続は見落とされる。

`disambiguate` は書こうとしているリンクの正しい行き先を選ぶためのコマンドであり、新しい接続を発見するものではない。`traverse` や `context` は既存グラフを辿るが、存在しない辺を提案しない。`serendipity` は検索ではなく創発的な橋渡しを目的にしたコマンドである。

提案の主観性が高く、必ずしも「正解」があるわけではないため、公式 CLI が持つには癖が強い。一方で、個人知識ベースや研究メモにおいては最も面白く、差別化しやすい拡張になりうる。

## コマンド形状

```bash
# あるノートから遠いが相性の良い接続候補を返す
obsidian plugin-serendipity seed=notes/llm-safety.md top=5

# 研究フォルダとプロジェクトフォルダの間で橋渡し候補を探す
obsidian plugin-serendipity left=research/ right=projects/ format=json

# 週次レビュー用に、意外性の高い提案だけ返す
obsidian plugin-serendipity tag=weekly-review min-distance=4 novelty=high

# 見出し単位まで候補対象を広げ、理由も説明する
obsidian plugin-serendipity query="知識蒸留" allow-heading-targets explain format=markdown
```

## オプション設計

- `seed=<path>` — 接続元の起点ノート
- `query=<text>` — 主題に近いノート群を起点にする
- `tag=<tag>` — 対象ノートをタグで絞る
- `left=<path>` — 提案元にするフォルダや prefix
- `right=<path>` — 提案先にするフォルダや prefix
- `min-distance=<n>` — 既存リンクグラフ上で最低何ホップ離れている候補だけを見る
- `top=<n>` — 返す提案数
- `novelty=balanced|high` — 意外性をどれだけ優先するか
- `allow-heading-targets` — ノート全体だけでなく見出し単位の接続も返す
- `explain` — 提案理由と橋渡しの観点を返す
- `format=text|markdown|json` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Serendipity suggestions from: notes/llm-safety.md

1. notes/release-checklist.md#Rollout
   novelty: 0.82
   rationale: "段階的公開" と "ロールバック条件" という運用上の構造が共通している
   bridge: 安全性ガードレールと本番リリース手順を結ぶノートを作ると有用

2. research/evaluation-metrics.md
   novelty: 0.77
   rationale: "失敗モードの観測" と "品質指標" が補完関係にある
   bridge: 安全評価チェックリストの観点を追加できる
```

### `format=json`

```json
{
	"seed": "notes/llm-safety.md",
	"suggestions": [
		{
			"source": "notes/llm-safety.md",
			"target": "notes/release-checklist.md#Rollout",
			"novelty": 0.82,
			"reasons": [
				"shared-pattern: staged rollout",
				"complementary-concern: rollback criteria",
				"graph-distance: 5"
			],
			"bridge": "安全性ガードレールと本番リリース手順を結ぶ運用ノートを作ると有用"
		}
	]
}
```

## 提案戦略

1. `seed` / `query` / `left` / `right` から起点集合と候補集合を決める
2. 既存リンクがある近傍ノートを除外し、十分に遠いノートだけを残す
3. 語彙の重なり、見出し構造の類似、タグやエイリアスの共通性、相補的な役割語彙を使って接続価値をスコアリングする
4. 似た理由ばかりにならないように多様化し、`novelty=high` ではグラフ距離の遠さを強く加点する
5. `explain` 指定時は、なぜその接続が面白いのかを短い橋渡し文として返す

これは厳密な推論結果ではなく、vault を再編成したり研究テーマを横断したりするための discovery primitive と捉える。

## 責務分離

- `packages/core` — 候補スコアリング、意外性と妥当性のバランス調整、多様化、説明文生成、出力整形
- `packages/plugin` — vault のリンク距離計算、タグ / エイリアス / 見出し情報の収集、対象ノート列挙、CLI adapter

`core` はノート内容とグラフ距離の入力から接続候補を選ぶ純粋ロジックに保つ。

## ビルトインとの差分

`disambiguate` は曖昧なリンク先の解決であり、書こうとしているリンクを正しく選ぶためのコマンドである。`traverse` は既存グラフの探索であり、`context` は既に関連しているノート群の収集である。

`serendipity` は「まだ存在しないが、結ぶと面白い辺」を提案する点で、既存コマンド群とは発想が根本的に異なる。
