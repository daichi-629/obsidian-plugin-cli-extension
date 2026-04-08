---
reviewed_at: 2026-04-08
impact: high
priority_rank: 1
existing_overlap:
  - "grep: frontmatter text は拾えるが、型推論・coverage 集計・validate はできない"
  - "apply-patch: 変更実行のみで、スキーマ判断材料は提供しない"
  - "per-note Properties inspection とは部分重複するが、vault-wide inference は提供しない"
proposal_overlap:
  - "audit: schema check の基盤として再利用される"
  - "impact / change-analysis: schema regression 判定に再利用される"
integration:
  needed: true
  decision: "単独コマンドとして維持し、集計ロジックだけ analysis-foundation に共有する"
  cluster: analysis-foundation
  shared_with:
    - audit
    - impact
    - change-analysis
  integrated_proposal: docs/feature-proposals/integrated/analysis-foundation.md
builtin_diff_assessment: "妥当。proposal 本文の properties / tags との差分説明は十分に成立している。"
recommendation: "最優先で実装する。決定論的で再利用範囲が広く、後続 proposal の土台になる。"
---

# Feature proposal: schema

## 概要

vault 全体のフロントマターを解析し、プロパティのスキーマ（キー名・型・カバレッジ）を推論して返すコマンド。「どのノートにどのプロパティが必要か」という構造を AI が把握できるようにする。

## 動機

vault が育つにつれ、フロントマターのプロパティは場当たり的に増え、ノートによって `date` だったり `created` だったりする。AI がフロントマターを読み書きしようとするとき、「このノートにどのキーを付けるべきか」を判断する根拠が現状では存在しない。

`schema` は `MetadataCache` が持つプロパティ情報をアグリゲートし、vault 全体で暗黙的に使われているスキーマを顕在化する。AI はこのスキーマを参照することで、フロントマターの変更を vault の慣習と整合させられる。

## コマンド形状

```bash
# vault 全体のフロントマタースキーマを推論する
obsidian plugin-schema format=json

# 特定フォルダ内のノートだけを対象にする
obsidian plugin-schema folder=notes format=json

# 指定プロパティを持たないノートを列挙する（バリデーション用途）
obsidian plugin-schema missing=tags folder=notes format=tsv

# あるノートがスキーマに対してどう違反しているかを検査する
obsidian plugin-schema validate path=notes/project.md format=json
```

## オプション設計

- `folder=<path>` — 対象フォルダを絞り込む（省略時: vault 全体）
- `tag=<tag>` — タグで対象ノートを絞り込む
- `missing=<key>` — 指定キーが存在しないノートを列挙するモード
- `validate` — `path` と組み合わせて、そのノートのフロントマターをスキーマに照合する
- `path=<path>` — `validate` モードで対象ノートを指定（必須）
- `min-coverage=<n>` — 表示するプロパティの最小カバレッジ（%）。低頻度キーを除外する
- `format=json|tsv|text` — 出力形式（デフォルト: `text`）

## 出力例

### デフォルト（`format=text`）

```text
Schema inferred from 248 notes

  tags          array     98%   (243/248)
  date          string    87%   (216/248)
  status        string    72%   (179/248)  values: todo, in-progress, done, archived
  project       string    41%   (102/248)
  created       string    12%    (30/248)  ⚠ overlaps with 'date'
  due           string     8%    (20/248)
```

### `format=json`

```json
{
	"note_count": 248,
	"properties": [
		{
			"key": "tags",
			"inferred_type": "array",
			"coverage": 0.98,
			"present_in": 243,
			"example_values": ["project", "idea", "reference"]
		},
		{
			"key": "date",
			"inferred_type": "string",
			"coverage": 0.87,
			"present_in": 216,
			"format_hint": "YYYY-MM-DD",
			"warnings": []
		},
		{
			"key": "status",
			"inferred_type": "string",
			"coverage": 0.72,
			"present_in": 179,
			"enum_candidates": ["todo", "in-progress", "done", "archived"]
		},
		{
			"key": "created",
			"inferred_type": "string",
			"coverage": 0.12,
			"present_in": 30,
			"warnings": ["possible_duplicate_of: date"]
		}
	]
}
```

### `missing=tags` （`format=tsv`）

```tsv
notes/quick-note.md
notes/scratch.md
daily/2026-04-01.md
daily/2026-04-02.md
daily/2026-04-03.md
```

### `validate path=notes/project.md` （`format=json`）

```json
{
	"path": "notes/project.md",
	"valid": false,
	"issues": [
		{
			"key": "tags",
			"issue": "missing",
			"coverage": 0.98,
			"severity": "high"
		},
		{
			"key": "created",
			"issue": "unusual_key",
			"note": "vault uses 'date' in 87% of notes; 'created' only 12%",
			"severity": "low"
		}
	],
	"frontmatter": {
		"status": "in-progress",
		"project": "alpha",
		"created": "2026-03-01"
	}
}
```

## スキーマ推論の戦略

1. `MetadataCache.getAllPropertyInfos()` が返す全プロパティをアグリゲートする
2. 各プロパティの型は Obsidian の `PropertyInfo.type` をそのまま使う（`text` / `tags` / `date` / `datetime` / `number` / `checkbox` / `aliases`）
3. `enum_candidates` は `text` 型プロパティの値が 10 種類以下のときに提示する
4. カバレッジが低いプロパティ同士で名前が類似している場合は `possible_duplicate_of` 警告を出す

## 将来拡張: segmented schema

単一の vault-wide schema だけでなく、「note type ごと」「tag ごと」に別の schema が存在するケースは多い。これに対する拡張は 2 段階で考える。

まず近い拡張としては、決定論的な `group-by` を導入して、既知の軸ごとに schema を比較できるようにする。例えば `type` property ごとの差を見る、tag ごとの差を見る、といった用途である。詳細な command surface は設計書側で扱う。

その先の高度な拡張としては、「どの tag / property 値が schema の分岐を最もよく説明するか」を自動検出するモードが考えられる。これは次のようなスコアリングで実現できる。

- ある tag を持つ集合と持たない集合で property coverage がどれだけ乖離するか
- ある property 値ごとに enum 候補や value shape がどれだけ安定して分かれるか
- 分割後の schema が分割前よりどれだけ説明力を持つか

さらに遠い将来には、note を property presence ベクトルとして扱い、教師なしで schema cluster を作ることも可能である。ただしこれは結果の説明可能性と安定性が下がりやすいので、少なくとも初期段階では「tag や property 値を説明変数として返す」方式を優先する。

## 責務分離

- `packages/core` — プロパティ集計ロジック、型推論・列挙候補の算出、重複警告の検出、バリデーション判定、出力整形
- `packages/plugin` — `MetadataCache.getAllPropertyInfos()` と `getFileCache()` の呼び出し、ファイルフィルタリング、CLI adapter

`core` は vault API に依存せず、プロパティの配列を入力として受け取る純粋な集計ロジックのみを持つ。

## ビルトインとの差分

`properties` コマンドは特定ノートのプロパティ一覧を返す。`tags` コマンドはタグの集計を返す。どちらも vault 全体のフロントマタースキーマを推論する機能は持たない。

`schema` は「vault が暗黙的に期待するフロントマターの構造」を顕在化する唯一のコマンドであり、AI がフロントマターを読み書きする際の判断基盤となる。
