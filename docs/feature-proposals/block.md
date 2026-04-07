# Feature proposal: block

## 概要

Obsidian のブロック参照システム（`^block-id`）をサブファイル粒度で読み書きする CLI コマンド。現在の `read` は必ずファイル全体を返すが、`block` はブロック ID を使って特定のパラグラフ・リストアイテム・見出しセクションだけを取得・更新できる。

## 動機

AI がノートを扱うとき、関心があるのはファイル全体ではなくその一部であることが多い。例えば「タスクリストの第3項だけ更新したい」「あるブロックへの参照がどこにあるか知りたい」という操作を、現状では `read` → パース → `apply-patch` という回り道でしか実現できない。

Obsidian はブロック参照 `[[note#^block-id]]` を内部的に管理しているが、CLI でその参照単位にアクセスする手段が存在しない。`block` コマンドはサブファイル粒度のアドレス可能性を CLI に持ち込む。

## コマンド形状

```bash
# ブロック ID でパラグラフを読む
obsidian plugin-block read path=notes/project.md id=abc123

# ファイル内の全ブロック ID を列挙する
obsidian plugin-block list path=notes/project.md format=json

# ブロックの内容を置き換える（ID が存在しない場合はエラー）
obsidian plugin-block write path=notes/project.md id=abc123 content="新しい内容"

# あるブロックを参照している全ノートを列挙する
obsidian plugin-block refs path=notes/project.md id=abc123 format=json
```

## オプション設計

### `block read`

- `path=<path>` — 対象ファイル（必須）
- `id=<block-id>` — ブロック ID（必須）
- `context=<n>` — ブロックの前後 N 行も返す（デフォルト: 0）
- `format=text|json` — 出力形式（デフォルト: `text`）

### `block list`

- `path=<path>` — 対象ファイル（必須）
- `format=json|tsv` — 出力形式（デフォルト: `tsv`）

### `block write`

- `path=<path>` — 対象ファイル（必須）
- `id=<block-id>` — ブロック ID（必須）
- `content=<text>` — 新しい内容（必須）
- `dry-run` — 変更せず結果を表示

### `block refs`

- `path=<path>` — 参照元ファイル（`path` か `id` を指定する場合に必須）
- `id=<block-id>` — ブロック ID（必須）
- `format=json|tsv` — 出力形式（デフォルト: `tsv`）

## 出力例

### `block read`

```text
タスクAの詳細実装については [[requirements#^abc123]] を参照。
完了予定: 2026-05-01
```

### `block list` （`format=json`）

```json
[
	{
		"id": "abc123",
		"line": 14,
		"type": "paragraph",
		"preview": "タスクAの詳細実装については..."
	},
	{ "id": "def456", "line": 28, "type": "list-item", "preview": "- 完了予定: 2026-05-01" },
	{ "id": "ghi789", "line": 35, "type": "heading", "level": 2, "preview": "## 進捗報告" }
]
```

### `block refs` （`format=json`）

```json
[
	{ "path": "daily/2026-04-07.md", "line": 5, "display": "[[project#^abc123]]" },
	{ "path": "notes/review.md", "line": 22, "display": "![[project#^abc123]]" }
]
```

### `block write` 実行結果

```text
Updated block ^abc123 in notes/project.md (line 14)
  Before: "タスクAの詳細実装については..."
  After:  "タスクAの実装は完了。詳細は notes/impl.md を参照。"
```

## 責務分離

- `packages/core` — ブロック ID のパース・抽出ロジック、行番号とブロック ID のマッピング、出力整形
- `packages/plugin` — `MetadataCache` を使ったブロック参照の解決、`TFile` の読み書き、vault-wide 参照スキャン、CLI adapter

ブロック ID の検出は Obsidian の `MetadataCache.getFileCache()` が返す `blocks` フィールドを活用し、正規表現による独自パースを避ける。

## ビルトインとの差分

`read` はファイル全体を返す。`search:context` は検索マッチの前後行を返すが、ブロック ID を引数として取れない。`replace` はテキストパターンベースで、ブロック ID を知っていても使えない。

`block` はブロック ID という Obsidian 固有のアドレス空間を CLI に露出させる唯一のコマンドであり、ブロック参照で構築された知識グラフの一部を正確に読み書きできる。
