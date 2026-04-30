---
reviewed_at: 2026-04-08
impact: high
priority_rank: 6
source_proposals:
    - impact
existing_overlap:
    - "excli-apply-patch --dry-run: patch validity までは見えるが semantic fallout は見えない"
    - "move with automatic link update: リンク更新までは見るが、schema 退行や orphan 化までは見ない"
proposal_overlap:
    - impact
    - refactor
    - workset
    - excli-schema:*
integration:
    cluster: analysis-foundation
    target_commands:
        - excli-apply-patch
        - refactor
    rationale: "semantic impact は独立 CLI より mutation workflow に近い"
builtin_diff_assessment: "妥当。現行の `dry-run` では semantic fallout が見えない。"
recommendation: "高優先度。feedback を踏まえて context-engine 系と delta の直後に置き、impact を独立機能ではなく共通 preflight engine として再定義する。"
---

# Integrated proposal: change-analysis

具体設計は [docs/design/change-analysis-design.md](../../design/change-analysis-design.md) を canonical とする。

## 概要

`impact` を独立コマンドとして追加する代わりに、既存の `excli-apply-patch` と将来の `refactor` が共有する semantic preflight engine として実装する提案。変更を「実行できるか」ではなく「vault 的に安全か」を、mutation workflow の中でそのまま返す。

`excli-schema:*` が既に存在するため、schema regression 判定は新規実装ではなく既存 analyzer の再利用として位置付ける。

## 統合理由

- このリポジトリには既に `excli-apply-patch` があり、差分入力と `dry-run` の UX が存在する
- `impact` のチェック項目は単独ユースよりも、変更前の確認として呼ばれる方が自然
- `refactor` や `workset` でも同じ link / embed / schema / orphan 判定を再利用できる
- 独立の `plugin-impact` を作ると、`dry-run` と責務が分かれすぎて操作面が重複する

## 推奨コマンド面

### `excli-apply-patch`

```bash
obsidian excli-apply-patch patch-file=tmp/change.patch dry-run
obsidian excli-apply-patch patch-file=tmp/change.patch dry-run checks=links,embeds,schema
obsidian excli-apply-patch patch-file=tmp/change.patch dry-run paths-only
obsidian excli-apply-patch patch-file=tmp/change.patch dry-run no-analyse
```

### 将来の `refactor`

```bash
obsidian plugin-refactor extract path=notes/big.md heading="機械学習" to=notes/ml.md dry-run
obsidian plugin-refactor merge from=notes/old.md into=notes/main.md dry-run
obsidian plugin-refactor extract path=notes/big.md heading="機械学習" to=notes/ml.md dry-run no-analyse
```

`dry-run` で semantic analysis を既定実行し、必要なときだけ `no-analyse` で無効化するのが重要である。

## 返すべき分析

- `links` — unresolved link の新規発生、既存リンクの消失
- `embeds` — broken embed や block / heading 参照切れ
- `orphans` — backlinks 消失による orphan 候補
- `schema` — frontmatter coverage や高頻度 property の回帰
- `aliases` — alias 衝突や解決不能化

`paths-only`、`checks=...`、JSON / text 出力は `impact` 提案の良い部分としてそのまま残す。

## 実装分離

- `packages/core` — 仮想ファイル集合への差分適用、前後比較、risk 判定、出力整形
- `packages/plugin` — 現在の vault snapshot 収集、`apply-patch` / `refactor` からの入力変換、CLI adapter

この形にすれば `audit` と `schema` が持つチェックロジックも同じ比較 engine に寄せられる。

## 採用判断

`impact.md` の価値自体は高いが、独立コマンドとして出すより既存 mutation surface に統合した方が、このリポジトリの現状実装と整合する。したがって canonical proposal は本書とし、元の `impact.md` は分析要件の入力として扱う。
