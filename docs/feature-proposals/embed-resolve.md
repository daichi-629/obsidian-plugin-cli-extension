---
reviewed_at: 2026-04-08
impact: high
priority_rank: 7
existing_overlap:
  - "grep: 埋め込み参照文字列の検索はできるが、再帰展開はできない"
  - "apply-patch: 内容変更はできても、表示相当の読み出しはできない"
proposal_overlap:
  - "context: context bundle の 1 オプションとしても使える"
  - "block: heading / block 抽出を共有する"
  - "workset: bundle 作成時の read mode として再利用できる"
integration:
  needed: true
  decision: "単独コマンドは残しつつ、context-engine の共通 resolver としても使う"
  cluster: context-engine
  shared_with:
    - context
    - block
    - workset
  integrated_proposal: docs/feature-proposals/integrated/context-engine.md
builtin_diff_assessment: "概ね妥当。生 Markdown と表示相当テキストの差は実運用上大きい。"
recommendation: "context-engine の初期段階で実装する。単独でも有用で、shared extractor としても価値が高い。"
---

# Feature proposal: embed-resolve

## 概要

ノート内の `![[...]]` トランスクルージョンを再帰的に展開し、埋め込みを含まない「フラット化されたコンテンツ」を返すコマンド。AI がノートを読む際に埋め込みの存在を意識せず、完全な内容を一度で取得できる。

## 動機

Obsidian では `![[other-note]]` や `![[note#heading]]`、`![[note#^block-id]]` による埋め込みが広く使われる。しかし `read` コマンドは生の Markdown を返すため、実際に表示される内容とは乖離がある。

AI がノートを読む場合、埋め込みを手動で解決するには「埋め込み参照を検出する → 各参照に対して `read` を発行する → 本文に挿入する」という複数ステップが必要になる。`embed-resolve` はこの手順をコマンド1回に畳み込む。

テンプレートを差し込んで使うノート、デイリーノートが複数のトピックノートを埋め込む構成、MOC（Map of Content）ノートなど、トランスクルージョンが構造の根幹にある vault では特に効果が高い。

## コマンド形状

```bash
# ノートの全埋め込みを展開して返す
obsidian plugin-embed-resolve path=notes/moc.md

# 展開の深さを制限する（デフォルト: 3）
obsidian plugin-embed-resolve path=notes/moc.md depth=1

# 展開元をコメントで明記する（どこから来たかを AI が追跡できる）
obsidian plugin-embed-resolve path=notes/moc.md annotate

# JSON 形式で展開ツリーを返す（デバッグ・構造解析用）
obsidian plugin-embed-resolve path=notes/moc.md format=json
```

## オプション設計

- `path=<path>` — 対象ファイル（必須）
- `depth=<n>` — 再帰展開の最大深さ（デフォルト: 3）
- `annotate` — 展開した埋め込みの前後に出典コメント（`<!-- embedded: note.md#heading -->`）を挿入する
- `format=markdown|json` — 出力形式（デフォルト: `markdown`）

## 出力例

対象ファイル `notes/moc.md` の内容:

```markdown
# プロジェクト概要

![[requirements]]

## 進捗

![[daily/2026-04-07#作業ログ]]
```

### `format=markdown`（デフォルト）

```markdown
# プロジェクト概要

## 要件定義

- 機能A: ユーザー認証
- 機能B: データエクスポート

### 非機能要件

レスポンスタイムは 200ms 以内。

## 進捗

### 作業ログ

- 機能A の実装完了
- 機能B は設計フェーズ
```

### `annotate` 付き

```markdown
# プロジェクト概要

<!-- embedded: notes/requirements.md -->

## 要件定義

...

<!-- end embedded: notes/requirements.md -->

## 進捗

<!-- embedded: daily/2026-04-07.md#作業ログ -->

### 作業ログ

...

<!-- end embedded: daily/2026-04-07.md#作業ログ -->
```

### `format=json`

```json
{
	"path": "notes/moc.md",
	"resolved": true,
	"depth_used": 2,
	"embed_count": 2,
	"tree": {
		"content": "# プロジェクト概要\n\n{embed:0}\n\n## 進捗\n\n{embed:1}",
		"embeds": [
			{
				"ref": "requirements",
				"resolved_path": "notes/requirements.md",
				"heading": null,
				"block_id": null,
				"content": "## 要件定義\n\n..."
			},
			{
				"ref": "daily/2026-04-07#作業ログ",
				"resolved_path": "daily/2026-04-07.md",
				"heading": "作業ログ",
				"block_id": null,
				"content": "### 作業ログ\n\n..."
			}
		]
	}
}
```

## 循環参照の処理

`A ![[B]]` かつ `B ![[A]]` のような循環が生じた場合:

1. 既に展開済みのパスを追跡するセットを管理する
2. 循環を検出した時点で展開を停止し、`<!-- circular-embed: notes/a.md -->` というコメントを挿入する
3. `format=json` の場合は `"circular": true` フラグを付与する

## 責務分離

- `packages/core` — 展開後テキストの組み立て、見出し・ブロック ID によるセクション抽出、循環検出、`annotate` コメント挿入、出力整形
- `packages/plugin` — `MetadataCache` による埋め込み参照の解決（ファイル名 → `TFile`）、`TFile` の読み出し、CLI adapter

セクション抽出（`#heading` / `#^block-id`）のロジックは `packages/core` で完結させ、`packages/plugin` は解決済みファイルの内容文字列を渡すだけにする。

## ビルトインとの差分

`read` は生の Markdown を返し、`![[...]]` を展開しない。`export:markdown` も同様に埋め込みを展開しない。`search:context` は検索マッチ前後の行を返すだけで、埋め込みの展開は行わない。

`embed-resolve` は「Obsidian が画面に表示する内容に近い、完全なテキスト」を CLI で返す唯一のコマンドであり、トランスクルージョンを多用する vault で AI が正確な内容を把握するために必要なプリミティブとなる。
