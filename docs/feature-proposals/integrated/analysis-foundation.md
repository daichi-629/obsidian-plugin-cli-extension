---
reviewed_at: 2026-04-08
impact: high
priority_rank: 22
scope: merged-proposal
source_proposals:
    - schema
    - audit
    - delta
    - impact
    - tasks-query
status: recommended
summary: "Uses the shipped schema foundation as the shared deterministic analysis stack for delta, tasks-query, audit, and change analysis."
---

# Integrated proposal: analysis-foundation

## 概要

`schema`, `audit`, `delta`, `impact`, `tasks-query` はいずれも vault の状態を解析するが、必要な下位機能は大半が共通している。コマンド面は分けたまま、設計と実装は 1 つの分析基盤に統合する。

このうち `excli-schema:*` は既に実装済みなので、本書では schema を「先に作る proposal」ではなく、共通 analyzer を切り出す出発点として扱う。

## なぜ統合するか

- vault スナップショット取得、パス/タグフィルタ、リンク/埋め込み/frontmatter 解析が重複している
- `schema` の推論結果を `audit` と `impact` がそのまま再利用できる
- `delta` の変更検出も、前後スナップショット比較という点で `impact` と同じ差分基盤に載せられる
- `tasks-query` も同じ snapshot / path filter / formatter を再利用できる
- 深刻度付けや `paths-only` 系フォーマットを共通化できる

## 共有コンポーネント

- 現在状態と仮想適用後状態を表せる vault snapshot モデル
- リンク、埋め込み、frontmatter、aliases の抽出器
- task line と due/status/tag/project の抽出器
- schema inference と schema validation
- 現在状態差分と前後状態差分の比較器
- severity / risk / paths-only / json / text の共通 formatter

## コマンド境界

- `schema`: プロパティの暗黙スキーマを返す基盤コマンド
- `tasks-query`: task を構造化条件で引く運用コマンド
- `audit`: 現在の vault の問題一覧を返す運用コマンド
- `delta`: ある時点以降の変化を返す監視コマンド
- `impact`: 仮変更後のリスクを返す安全確認コマンド

統合対象は実装基盤であり、ユーザー向けのコマンド名までは 1 つにまとめない。

## 推奨導入順

1. `excli-schema:*` から共通 snapshot / schema analyzer を抽出する
2. `delta` と `tasks-query` をその上に載せ、日常的な read-side analyzer を固める
3. `audit` を載せて現状診断を統合する
4. `integrated/change-analysis.md` の形で mutation preflight へ拡張する
