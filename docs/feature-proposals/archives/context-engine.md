---
reviewed_at: 2026-04-08
archived_at: 2026-04-10
status: archived
archive_reason: |
    この統合提案が想定していた 5 コマンド構成（traverse + read-bulk + embed-resolve +
    context + narrative）から、設計変更で 2 つのコマンドが落ちたため陳腐化した。
    具体的には context コマンドは traverse:reach + read:bulk の compose で代替可能として
    単独実装を取りやめ、embed-resolve コマンドは read:bulk の resolve-embeds フラグに統合した。
    結果として「5 つを束ねる統合提案」としての位置づけが成立しなくなった。
    残る read-bulk と narrative は各自の proposal ファイルで管理を継続する。
impact: high
scope: merged-proposal
source_proposals:
    - traverse
    - read-bulk
    - embed-resolve
    - context
    - narrative
summary: "Builds bulk read, context, and narrative packaging on top of the shipped traverse primitive plus future content resolvers."
---

# Integrated proposal: context-engine

## 概要

`traverse`, `read-bulk`, `embed-resolve`, `context`, `narrative` はすべて「どのノート断片を集め、どの順序で見せるか」という問題を扱っている。コマンドを 1 つにまとめる必要はないが、graph traversal、bulk fetch、content resolution の実装は統合すべきである。

`excli-traverse:*` は既に実装済みなので、本書では traverse を future work ではなく既存 graph primitive として扱う。

## なぜ統合するか

- `context` と `narrative` はどちらも候補ノート収集で `traverse` 相当を必要とする
- `read-bulk` がないと、AI は複数ノートを読むたびに `read` を反復することになる
- `context` と `narrative` の本文整形は `embed-resolve` の展開器を共有できる
- path / depth / direction / token budget / citation まわりの制御が重複している
- 高レベル機能から先に作ると、graph と transclusion の扱いが二重実装になりやすい

## 共有コンポーネント

- graph traversal と shortest-path / neighborhood 取得
- path / folder / tag による deterministic な bulk note loading
- heading / block / embed の content resolver
- depth, direction, folder, tag などの対象絞り込み
- token budget と truncation の制御
- note bundle を markdown / json に変換する formatter

## コマンド境界

- `traverse`: グラフ探索そのものを露出する低レベルコマンド
- `read-bulk`: 明示対象の複数ノートを 1 回で返す低レベルコマンド
- `embed-resolve`: transclusion を展開する低レベルコマンド
- `context`: AI 入力向けに関連ノート束を返す高レベルコマンド
- `narrative`: 時系列に再構成した高レベルコマンド

高レベルの 2 コマンドは、低レベルの 3 コマンドを内部基盤として利用する前提で整理する。

## 推奨導入順

1. 既存の `excli-traverse:*` の `direction=out` 問題を閉じ、graph primitive を安定化する
2. `read-bulk` を追加して multi-note fetch を 1 round trip にする
3. `embed-resolve` を追加して content resolution を揃える
4. `context` を追加して AI 向け bundle 生成を成立させる
5. `narrative` を最後に載せて時系列再構成へ広げる

2026-04-10 の feedback を踏まえると、この cluster は「エージェントが `read` を何度も往復しなくて済むようにする」ための最優先領域である。したがって `read-bulk` を concrete proposal として追加し、その上に `embed-resolve` と `context` を載せる構成を canonical とする。
