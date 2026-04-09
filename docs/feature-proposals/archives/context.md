---
reviewed_at: 2026-04-08
archived_at: 2026-04-10
status: archived
archive_reason: |
    excli-context の差別化は「1-shot の利便性」だけであり、excli-traverse:reach + excli-read:bulk
    の 2 ステップで十分に代替できる。traverse:reach が返すのはパスとグラフ構造のみ（軽量メタデータ）
    なので 2 回目のラウンドトリップコストは小さい。加えて、direction=both で返ってくる
    BundleEntry.relation が一律 "linked" になり in/out の区別ができない情報損失と、
    ハブノードを seed にした場合の候補爆発リスクもあった。
    コマンド数を増やすコストに見合わないと判断し、単独コマンドとしての実装を取りやめた。
impact: high
existing_overlap:
    - "excli-grep: 候補ノート抽出には使えるが、リンク辿りや token budget 付き bundling はできない"
    - "excli-apply-patch: 読み取り用コンテキスト生成とは役割が別"
    - "manual search/read workflows とは部分重複する"
proposal_overlap:
    - "read-bulk: 明示対象の一括取得と token budget 制御を共有する"
    - "excli-traverse:*: 関連ノート収集の graph traversal を既存実装から再利用する"
    - "embed-resolve: 収集後コンテンツの flatten 処理を共有できる"
    - "workset: note bundle 収集部分を共有できる"
    - "narrative: 同じ収集基盤から時間軸だけ別整形する"
integration:
    needed: true
    decision: "単独コマンドは維持し、context-engine 上の高レベル bundle surface として実装する"
    cluster: context-engine
    shared_with:
        - traverse
        - embed-resolve
        - workset
        - narrative
    integrated_proposal: docs/feature-proposals/integrated/context-engine.md
builtin_diff_assessment: "妥当。read や search:context の延長ではなく、AI 向け bundle 生成という別目的になっている。"
recommendation: "高優先度を維持する。既存の `excli-traverse:*` と `read-bulk` を土台にし、`embed-resolve` の直後に AI 向け bundle surface として載せる。"
---

# Feature proposal: context

## 概要

AI に渡すためのコンテキストパケットを vault から自動組み立てするコマンド。シードノート周辺の関連ノートを収集し、必要なら `![[...]]` トランスクルージョンも再帰的に展開して、LLM にそのまま渡せる束として返す。

この提案は旧 `context` と `embed-resolve` を統合し、「どのノートを読むか」と「ノートが実際に何を表示しているか」を 1 コマンドで扱う。明示 path / folder / tag による bulk fetch 自体は `read-bulk` に分離し、`context` はその上に載る graph-aware bundle surface とする。

## 動機

AI が vault を参照するとき、現状は `read` を個別に繰り返すか、`grep` で候補を拾ってから手動で辿るしかない。しかし実際の Obsidian ノートはリンクとトランスクルージョンで意味的に構成されており、関連ノートの選定と埋め込み展開を別々にやるのは不自然である。

`context` は「AI の入力を組み立てるコマンド」として、関連ノートの収集、トークン予算による打ち切り、埋め込み展開、出典注釈までまとめて担当する。`read-bulk` が「何をそのまま読むか」を扱うのに対し、`context` は「どの周辺ノートを束ねるべきか」を扱う。

## コマンド形状

```bash
# あるノートと深さ 1 の関連ノートをまとめて返す
obsidian plugin-context path=notes/project.md depth=1 format=xml

# 関連ノートを集めつつ、各ノート内の埋め込みも展開する
obsidian plugin-context path=notes/moc.md depth=1 resolve-embeds embed-depth=2 format=markdown

# テキストクエリでシードを選び、上位ノートだけを収集する
obsidian plugin-context query="機械学習 実装" top=5 max-tokens=8000 format=markdown

# 埋め込み元をコメントで残す
obsidian plugin-context path=notes/moc.md resolve-embeds annotate-embeds format=json
```

## オプション設計

- `path=<path>` — シードノート（`path` か `query` のどちらか必須）
- `query=<text>` — テキストクエリ（vault 内検索でシード候補を選ぶ）
- `depth=<n>` — 関連ノート探索の深さ（デフォルト: `1`）
- `direction=out|in|both` — リンクの向き（デフォルト: `both`）
- `tag=<tag>` — 収集対象をタグで絞る
- `top=<n>` — 収集するノート数の上限
- `max-tokens=<n>` — 概算トークン数でパケットを打ち切る
- `resolve-embeds` — 各ノート内の `![[...]]` を展開する
- `embed-depth=<n>` — 埋め込み展開の最大深さ（デフォルト: `2`）
- `annotate-embeds` — 展開した埋め込みの前後に出典コメントを付ける
- `format=xml|markdown|json` — 出力形式

## 出力例

### `format=markdown`

```markdown
<!-- context: notes/project.md + 2 related notes -->

## notes/project.md (seed, hops=0)

# Project X

<!-- embedded: notes/requirements.md -->

## 要件定義

...

<!-- end embedded: notes/requirements.md -->

## notes/ml-basics.md (linked, hops=1)

...
```

### `format=json`

```json
{
	"seed": "notes/moc.md",
	"collected": 3,
	"truncated": false,
	"notes": [
		{
			"path": "notes/moc.md",
			"relation": "seed",
			"hops": 0,
			"resolved_embeds": [
				{
					"ref": "requirements",
					"resolved_path": "notes/requirements.md"
				}
			],
			"content": "# プロジェクト概要\n\n..."
		}
	]
}
```

## パケット組み立て戦略

1. `path` または `query` からシードノートを決める
2. リンク距離、タグ、検索一致度で関連ノートをスコアリングする
3. `resolve-embeds` 指定時は各ノート内の埋め込みを再帰展開する
4. 循環埋め込みは検出して停止し、注釈またはフラグで返す
5. シードノートを必ず残しつつ、`max-tokens` を超えた時点で打ち切る

トークン数の推定は文字数ベースの近似（4 文字 ≈ 1 token）とし、正確なカウントは行わない。

## 責務分離

- `packages/core` — コンテキストパケットの型定義、ノードのスコアリング、トークン推定、埋め込み展開、循環検出、出力整形
- `packages/plugin` — vault からのノード収集、リンク解決、`TFile` の読み出し、埋め込み参照の解決、CLI adapter

`core` は「どの情報をどの順で AI に渡すか」を担当し、`plugin` は vault から素材を集める。

## ビルトインとの差分

`read` は単一ファイルの生テキストしか返さない。検索系ワークフローは関連ノートの束や埋め込み展開を自動で作ってくれない。`context` は「AI が読むべきまとまり」を返すことに特化したコマンドであり、旧 `embed-resolve` の責務をその中に取り込む。
