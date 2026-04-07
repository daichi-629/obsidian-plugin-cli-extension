# Feature proposal: context

## 概要

AI に渡すためのコンテキストパケットを vault から自動組み立てするコマンド。シードノートとそこからリンクされた関連ノートを収集し、LLM のコンテキストウィンドウに直接流し込める形式で返す。

## 動機

AI が vault を参照するとき、現状は `read` を個別に繰り返すしかない。しかしノートはリンクで意味的につながっており、関連ノートを手動で辿るのは非効率である。`context` は「どのノートを読むか」の判断を vault 側に移譲し、AI は取得した束を読むことに集中できる。

ファイル操作コマンドではなく「AI の入力を構築するコマンド」という発想の逆転がある。

## コマンド形状

```bash
# あるノートと深さ 1 の被リンクノートをまとめて返す
obsidian plugin-context path=notes/project.md depth=1 format=xml

# テキストクエリで関連ノートをスコアリングして収集する
obsidian plugin-context query="機械学習 実装" top=5 format=markdown

# タグで絞り込んでコンテキストを組む
obsidian plugin-context tag=project depth=1 max-tokens=8000
```

## オプション設計

- `path=<path>` — シードノート（`path` か `query` のどちらか必須）
- `query=<text>` — テキストクエリ（vault 内検索でシードを選ぶ）
- `depth=<n>` — リンクを辿る深さ（デフォルト: 1）
- `direction=out|in|both` — リンクの向き（デフォルト: `both`）
- `tag=<tag>` — 収集対象をタグで絞る
- `top=<n>` — 収集するノート数の上限
- `max-tokens=<n>` — 概算トークン数でコンテキストを打ち切る
- `format=xml|markdown|json` — 出力形式

## 出力例

### `format=xml`

```xml
<context query="機械学習 実装" collected="3" truncated="false">
  <note path="notes/project.md" relation="seed" hops="0">
# プロジェクトX

機械学習を使った...
  </note>
  <note path="notes/ml-basics.md" relation="linked" hops="1">
# 機械学習基礎

線形回帰は...
  </note>
  <note path="daily/2026-04-07.md" relation="backlink" hops="1">
## 作業ログ

プロジェクトXの実装を...
  </note>
</context>
```

### `format=markdown`

```markdown
<!-- context: notes/project.md + 2 related notes -->

## notes/project.md (seed)

...

## notes/ml-basics.md (linked, hops=1)

...
```

## `max-tokens` の打ち切り戦略

1. シードノートは必ず含める
2. 関連度スコアの高い順に追加
3. 推定トークン数が上限を超えた時点で停止
4. 打ち切りが発生した場合は末尾に `truncated=true` を付記する

トークン数の推定は文字数ベースの近似（4 文字 ≈ 1 token）とし、正確なカウントは行わない。

## 責務分離

- `packages/core` — コンテキストパケットの型定義、ノードのスコアリング、トークン推定、出力整形
- `packages/plugin` — vault からのノード収集、リンク解決、`TFile` の読み出し、CLI adapter

## ビルトインとの差分

`read` は単一ファイルの内容取得。`search:context` は検索結果の前後行表示。`context` は「AI の入力として意味的にまとまったノート群を返す」という目的が根本的に異なる。
