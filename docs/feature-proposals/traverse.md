# Feature proposal: traverse

## 概要

vault のリンクグラフを探索するコマンド。`links` / `backlinks` が隣接 1 ホップのリストを返すのに対し、`traverse` はグラフ上の経路探索・クラスター検出・到達可能範囲の列挙を行う。

## 動機

Obsidian のコア価値はリンク構造による知識グラフである。しかし既存の CLI コマンドはグラフを「1 ホップのリスト」としてしか露出しない。AI がノート間の関係を推論・ナビゲートするためには、グラフ構造をアルゴリズム的に走査できる CLI プリミティブが必要になる。

## コマンド形状

```bash
# 2 ノート間の最短リンクパスを返す
obsidian plugin-traverse from="PKM" to="機械学習" shortest-path

# あるノートから N ホップ以内に到達できるノート群
obsidian plugin-traverse from="プロジェクトX" depth=2 format=json

# 孤立したリンククラスターを検出する
obsidian plugin-traverse clusters min-size=3 format=json
```

## オプション設計

- `from=<name|path>` — 起点ノート
- `to=<name|path>` — 終点ノート（`shortest-path` 時に必須）
- `depth=<n>` — 探索深さ（デフォルト: 2）
- `shortest-path` — 最短経路モード
- `clusters` — クラスター検出モード
- `min-size=<n>` — クラスター最小サイズ（`clusters` 時のみ有効）
- `direction=out|in|both` — リンクの向き（デフォルト: `out`）
- `format=json|tsv|text` — 出力形式

## 出力例

### `shortest-path`

```text
PKM → ノート管理 → 機械学習
hops: 2
```

### `depth`

```json
{
	"seed": "プロジェクトX",
	"nodes": [
		{ "path": "notes/project-x.md", "hops": 0 },
		{ "path": "notes/requirements.md", "hops": 1 },
		{ "path": "notes/ml-basics.md", "hops": 2 }
	],
	"edges": [
		{ "from": "notes/project-x.md", "to": "notes/requirements.md" },
		{ "from": "notes/requirements.md", "to": "notes/ml-basics.md" }
	]
}
```

### `clusters`

```json
[
	{
		"id": 0,
		"size": 5,
		"nodes": ["notes/a.md", "notes/b.md", "notes/c.md", "notes/d.md", "notes/e.md"]
	}
]
```

## 責務分離

- `packages/core` — グラフ構造の型定義、BFS/DFS 探索、クラスター検出アルゴリズム
- `packages/plugin` — vault のリンクデータ収集、`TFile` → グラフノードの変換、CLI adapter

`core` はリンクデータを受け取るだけで、vault API には触れない。

## ビルトインとの差分

`links` / `backlinks` / `orphans` / `deadends` はいずれも 1 ホップの集計。`traverse` はグラフ走査そのものを提供する点で根本的に異なる。
