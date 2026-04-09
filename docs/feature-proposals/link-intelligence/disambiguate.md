---
reviewed_at: 2026-04-08
impact: high
priority_rank: 9
existing_overlap:
    - "excli-grep: lexical candidate recall はできるが、link target ranking と risk 付けはできない"
    - "excli-apply-patch: リンクを書き込めても、正しいリンク先の選定は支援しない"
    - "manual search and alias lookup workflows とは部分重複する"
proposal_overlap:
    - "excli-traverse:*: context-path からの距離計算を既存 graph primitive から共有する"
    - "graph-hubs: hub score を link target ranking signal に使える"
    - "block: heading / block target 候補の解決で共有する"
    - "serendipity: candidate scoring 基盤の一部を共有する"
integration:
    needed: true
    decision: "単独コマンドは維持し、link-intelligence 系の ranking surface として扱う"
    cluster: link-intelligence
    shared_with:
        - traverse
        - block
        - serendipity
    integrated_proposal: null
builtin_diff_assessment: "概ね妥当。検索結果の列挙と『どれにリンクすべきか』の意思決定支援は別物。"
recommendation: "既存の `excli-traverse:*` を前提に検討する。AI の誤リンク削減に直結し、ユーザー価値が分かりやすい。"
---

# Feature proposal: disambiguate

## 概要

曖昧な語や略称を、vault 内のどのノート・見出し・ブロックにリンクすべきかという形でランキングして返すコマンド。AI が `[[...]]` を書く前に、正しいリンク先とその理由を取得できるようにする。

## 動機

人間は vault の慣習や最近触ったノートを前提に「この `roadmap` はあのノートだ」と判断できる。しかし AI にはその暗黙知がないため、同名ノート、似たタイトル、重複エイリアスがある vault で誤リンクを作りやすい。

単純な `search` 結果では候補が並ぶだけで、どれをリンク先に採用すべきかが分からない。`disambiguate` は「検索」ではなく「リンク解決の意思決定」を補助するコマンドである。

## コマンド形状

```bash
# 文脈ノートから見て "roadmap" がどれを指すか推定する
obsidian plugin-disambiguate mention="roadmap" context-path=notes/project.md

# 文中の略称を元にリンク候補を返す
obsidian plugin-disambiguate mention="ML" sentence="この仕様は ML の前提を整理する" format=json

# 現在ノートと強く結びついた候補を優先する
obsidian plugin-disambiguate mention="review" context-path=daily/2026-04-08.md prefer=linked

# 適切な候補が薄い場合は新規ノート作成提案も返す
obsidian plugin-disambiguate mention="release checklist" allow-create-suggestion
```

## オプション設計

- `mention=<text>` — 解決したい語や略称（必須）
- `context-path=<path>` — 現在編集しているノート
- `sentence=<text>` — その語が現れた文。周辺語から意味を絞る
- `heading=<heading>` — 見出し候補まで含めて解決する
- `top=<n>` — 返す候補数（デフォルト: 5）
- `prefer=linked|recent|folder:<path>|tag:<tag>` — ランキングのバイアス
- `allow-create-suggestion` — 十分な候補がない場合に「新規ノート候補」を返す
- `format=json|text|tsv` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Disambiguation for "roadmap"

1. notes/project-roadmap.md
   canonical: [[project-roadmap]]
   reasons: exact alias match, linked from notes/project.md, modified recently

2. notes/company-roadmap.md
   canonical: [[company-roadmap]]
   reasons: title contains roadmap, shared tag #planning

3. notes/roadmap-template.md
   canonical: [[roadmap-template]]
   reasons: title match only
```

### `format=json`

```json
{
	"mention": "ML",
	"candidates": [
		{
			"path": "notes/machine-learning.md",
			"canonical_link": "[[machine-learning]]",
			"score": 0.89,
			"reasons": ["alias-match: ML", "context-link-proximity", "shared-keywords: 仕様, 前提"],
			"risk": "low"
		},
		{
			"path": "notes/market-launch.md",
			"canonical_link": "[[market-launch]]",
			"score": 0.41,
			"reasons": ["alias-match: ML"],
			"risk": "high"
		}
	],
	"create_suggestion": null
}
```

## ランキング戦略

1. タイトル完全一致、エイリアス一致、見出し一致を強く加点する
2. `context-path` がある場合は、現在ノートからのリンク距離や共通タグで加点する
3. `sentence` がある場合は周辺語との共起で候補を再スコアする
4. 上位候補同士の点差が小さい場合は `risk=high` として返す

AI は 1 位を盲信するのではなく、`risk` と `reasons` を見てリンクを書くべきか、人間確認に回すべきかを決められる。

## 責務分離

- `packages/core` — 候補ランキング、スコア内訳の生成、`create_suggestion` 判定、出力整形
- `packages/plugin` — タイトル・エイリアス・見出し・リンク距離など vault 由来データの収集、CLI adapter

候補評価のロジックは `core` に閉じ込め、`plugin` は候補素材を集める役割に限定する。

## ビルトインとの差分

`search` は候補文字列を返すが、`[[どれにリンクすべきか]]` という決定を支援しない。`aliases` や `links` 系コマンドがあっても、文脈込みで候補を順位付けする層は存在しない。

`disambiguate` は AI の誤リンクを減らすためのコマンドであり、人間向けの検索よりも自動化された執筆支援に寄った機能である。
