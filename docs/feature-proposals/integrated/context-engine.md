---
reviewed_at: 2026-04-08
scope: merged-proposal
source_proposals:
  - traverse
  - embed-resolve
  - context
  - narrative
status: recommended
summary: "Separates graph and content-resolution primitives from higher-level context and narrative packaging."
---

# Integrated proposal: context-engine

## 概要

`traverse`, `embed-resolve`, `context`, `narrative` はすべて「どのノート断片を集め、どの順序で見せるか」という問題を扱っている。コマンドを 1 つにまとめる必要はないが、graph traversal と content resolution の実装は統合すべきである。

## なぜ統合するか

- `context` と `narrative` はどちらも候補ノート収集で `traverse` 相当を必要とする
- `context` と `narrative` の本文整形は `embed-resolve` の展開器を共有できる
- path / depth / direction / token budget / citation まわりの制御が重複している
- 高レベル機能から先に作ると、graph と transclusion の扱いが二重実装になりやすい

## 共有コンポーネント

- graph traversal と shortest-path / neighborhood 取得
- heading / block / embed の content resolver
- depth, direction, folder, tag などの対象絞り込み
- token budget と truncation の制御
- note bundle を markdown / json に変換する formatter

## コマンド境界

- `traverse`: グラフ探索そのものを露出する低レベルコマンド
- `embed-resolve`: transclusion を展開する低レベルコマンド
- `context`: AI 入力向けに関連ノート束を返す高レベルコマンド
- `narrative`: 時系列に再構成した高レベルコマンド

高レベルの 2 コマンドは、低レベルの 2 コマンドを内部基盤として利用する前提で整理する。

## 推奨導入順

1. `embed-resolve` と `traverse` を実装して共通基盤を固める
2. `context` を追加して AI 向け bundle 生成を成立させる
3. `narrative` を最後に載せて時系列再構成へ広げる
