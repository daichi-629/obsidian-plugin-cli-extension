---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 15
existing_overlap:
    - "excli-apply-patch: multi-file 更新はできるが、section extract / backlink relink のような graph-aware operation は持たない"
    - "move with automatic link update とは部分重複するが、graph restructuring までは扱えない"
proposal_overlap:
    - "block: heading section 抽出を共有する"
    - "impact / change-analysis: 実行前 preflight が必須"
    - "workset: multi-file mutation backend を共有できる"
integration:
    needed: true
    decision: "単独 command surface は維持し、実装は apply-patch backend + impact preflight に寄せる"
    cluster: editing-primitives
    shared_with:
        - block
        - impact
        - change-analysis
        - workset
    integrated_proposal: null
builtin_diff_assessment: "概ね妥当。move では graph restructuring までは扱えない。"
recommendation: "中盤以降。既存の `excli-apply-patch` を低レベル backend に使いつつ、block と change-analysis/impact の後に載せる。"
---

# Feature proposal: refactor

## 概要

ノートの内容ではなくリンクグラフの構造を変形するコマンド。セクションの切り出し、ノートの統合、リンクの一括張り替えを、バックリンクの整合性を保ちながら行う。

## 動機

vault が育つにつれ、ノートの粒度や構造が変化する。`move` / `delete` / `apply-patch` の組み合わせではリンクの整合性を保てない。`refactor` はグラフ構造を壊さずにノートを分割・統合・移植する操作を提供する。

AI がリファクタリングを提案し、このコマンドで実行するというワークフローを想定している。

## コマンド形状

```bash
# 見出しセクションを独立ノートに切り出し、元の場所にウィキリンクを残す
obsidian plugin-refactor extract path=notes/big.md heading="機械学習" to=notes/ml.md

# 2 つのノートを 1 つに統合し、古いノートをリダイレクトに変える
obsidian plugin-refactor merge from=notes/old.md into=notes/main.md

# あるノートへの全バックリンクを別ノートに張り替える
obsidian plugin-refactor relink from=notes/deprecated.md to=notes/new.md

# dry-run で変更内容を確認する
obsidian plugin-refactor extract path=notes/big.md heading="機械学習" to=notes/ml.md dry-run
```

## サブコマンドと操作内容

### `extract`

指定した見出しセクションを新しいノートに切り出す。

- 元のノートのセクション本文を削除し、`[[新ノート名]]` で置き換える
- 新ノートの冒頭に見出し (`# 機械学習`) を挿入する
- 新ノートへのバックリンクは元のノートのみになる

オプション:

- `path=<path>` — 元ノート（必須）
- `heading=<heading>` — 切り出す見出し（必須）
- `to=<path>` — 新ノートのパス（必須）
- `dry-run` — 変更せず結果を表示

### `merge`

2 つのノートを 1 つに統合する。

- `from` ノートの内容を `into` ノートの末尾に追記する
- `from` ノートへのバックリンクを全て `into` ノートに張り替える
- `from` ノートを削除するか、リダイレクト用スタブに置き換えるかを選べる

オプション:

- `from=<path>` — 統合元（必須）
- `into=<path>` — 統合先（必須）
- `keep-stub` — `from` ノートをリダイレクトスタブとして残す
- `dry-run`

リダイレクトスタブの形式:

```markdown
---
redirects_to: "[[統合先ノート]]"
---

> このノートは [[統合先ノート]] に統合されました。
```

### `relink`

あるノートへの全バックリンクを別ノートに張り替える。ノートの内容は変更しない。

- vault 内の `[[from]]` を全て `[[to]]` に置き換える
- `from` ノート自体はそのまま残る

オプション:

- `from=<path>` — リンク張り替え元（必須）
- `to=<path>` — リンク張り替え先（必須）
- `dry-run`

## 出力例

### `extract` デフォルト

```text
Extracted "機械学習" from notes/big.md → notes/ml.md
  Removed: 42 lines from notes/big.md
  Created: notes/ml.md (44 lines)
  Inserted: [[ml]] at notes/big.md:18
```

### `merge` dry-run

```text
Dry run: merge notes/old.md → notes/main.md
  Append: 28 lines to notes/main.md
  Relink: 3 files (notes/a.md, notes/b.md, notes/c.md)
  Stub: notes/old.md (redirects_to: [[main]])
```

## 責務分離

- `packages/core` — セクション分割ロジック、リダイレクトスタブ生成、出力整形
- `packages/plugin` — vault 全体のリンクスキャン、バックリンク書き換え、vault adapter、CLI adapter

バックリンクの書き換えは vault API が提供する `MetadataCache` を使い、全ファイルのスキャンを避ける。

## ビルトインとの差分

`move` はファイルを移動するが Obsidian はリンクを自動更新する。しかしセクション抽出・ノート統合・リンク一括張り替えという **グラフ構造の変形** は `move` の組み合わせでは実現できない。
