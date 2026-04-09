---
reviewed_at: 2026-04-10
impact: medium
priority_rank: 11
existing_overlap:
    - "excli-schema:missing / validate: 欠落や逸脱は見えるが、まとめて修正はできない"
    - "excli-apply-patch: 書き換えはできるが、frontmatter property に特化した bulk maintenance は持たない"
    - "manual frontmatter edits とは部分重複するが、対象選定と dry-run が重い"
proposal_overlap:
    - "excli-schema:*: key/value 正規化や coverage 判断を共有できる"
    - "change-analysis: bulk write 前の semantic preflight を共有する"
    - "workset: multi-file mutation backend を共有できる"
    - "refactor: graph-aware mutation と同じ apply backend を共有できる"
integration:
    needed: true
    decision: "単独 command surface は維持し、schema-aware bulk maintenance primitive として editing-primitives に置く"
    cluster: editing-primitives
    shared_with:
        - schema
        - change-analysis
        - workset
        - refactor
    integrated_proposal: null
builtin_diff_assessment: "妥当。複数ノートの frontmatter を条件付きでまとめて整える surface は既存の低レベル patch では代替しにくい。"
recommendation: "中優先度。context / delta の後に、schema maintenance の自動化 surface として着手する。"
---

# Feature proposal: property-bulk-set

## 概要

複数ノートの frontmatter property を条件付きで一括更新するコマンド。対象ノートの絞り込み、dry-run、patch preview を備え、schema 整合性を保ちながらメンテナンス作業を進められるようにする。

## 動機

vault のメンテナンスでは、「Archive/2025 配下の status を全部 archive にする」「特定タグの zettel_type を揃える」といった単純だが件数の多い作業が頻繁に起きる。今は 1 ファイルずつ `apply-patch` するか、外部スクリプトを書くしかない。

feedback でも、property の一括更新は schema maintenance の現実的なボトルネックとして挙がっていた。`property-bulk-set` は複雑な refactor ではなく、決定論的な frontmatter maintenance を担う。

## コマンド形状

```bash
# folder 配下の status を archive に揃える
obsidian excli-property:bulk-set name=status value=archive folder=Archive/2025 dry-run

# 特定 tag を持つノートへ property を追加する
obsidian excli-property:bulk-set name=zettel_type value=fleeting tag=02_fleeting if-missing

# 明示 path 群だけを更新する
obsidian excli-property:bulk-set name=project value=alpha paths=notes/a.md,notes/b.md format=json

# 値を消す
obsidian excli-property:bulk-set name=legacy_status mode=remove folder=notes/legacy dry-run
```

## オプション設計

- `name=<key>` — 更新する property 名
- `value=<scalar|json>` — 設定する値
- `mode=set|append|remove|clear` — 更新モード
- `paths=<path,path,...>` — 明示対象
- `folder=<path>` — 対象フォルダ
- `tag=<tag>` — 対象タグ
- `if-missing` — 既存値がないノートだけ更新する
- `dry-run` — 実際には書かず、対象と差分だけ返す
- `format=text|json|patch` — 出力形式

## 出力例

### `dry-run format=text`

```text
Property bulk-set dry-run

  update: Archive/2025/a.md   status: active -> archive
  update: Archive/2025/b.md   status: review -> archive
  skip:   Archive/2025/c.md   status already archive

Total: 2 updates, 1 skipped
```

### `format=json`

```json
{
	"key": "status",
	"mode": "set",
	"updates": [
		{
			"path": "Archive/2025/a.md",
			"before": "active",
			"after": "archive"
		}
	],
	"skipped": [
		{
			"path": "Archive/2025/c.md",
			"reason": "already-equal"
		}
	]
}
```

## 更新戦略

1. `paths` または `folder` / `tag` から対象ノートを決める
2. frontmatter を抽出し、`mode` に応じて新値を計算する
3. `dry-run` なら patch preview または before/after だけ返す
4. 実行時は `apply-patch` backend へ変換して書き戻す
5. 必要なら `change-analysis` の preflight を差し込む

## 責務分離

- `packages/core` — property 更新ロジック、mode ごとの値変換、dry-run 出力整形
- `packages/plugin` — frontmatter 読出し、対象ノート収集、patch 生成と適用、CLI adapter

## ビルトインとの差分

`schema` は frontmatter の状態を読むが、直さない。`apply-patch` は直せるが、対象選定も property 更新も user が毎回自分で組む必要がある。`property-bulk-set` は schema maintenance を first-class な command として切り出す。
