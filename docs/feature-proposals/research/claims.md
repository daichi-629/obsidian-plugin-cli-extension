---
status: merged-proposal
origin:
    - evidence.md
    - tension.md
reviewed_at: 2026-04-08
impact: medium
priority_rank: 12
existing_overlap:
    repo:
        - "excli-grep (partial: lexical recall only)"
    built_in:
        - "manual search-and-compare workflows (partial)"
proposal_overlap:
    - narrative
integration:
    cluster: claim-analysis
    target_modes:
        - evidence-style
        - tension-style
    integrated_proposal: null
    rationale: "根拠収集と衝突検出は同じ claim/evidence 抽出基盤に乗るため、mode で束ねる価値が高い。"
recommendation: "evidence と tension を別 surface のまま維持するより、共通 mode command としてまとめる価値が高い。"
---

# Feature proposal: claims

## 概要

質問・主張・作業方針に対する根拠収集と、vault 内で衝突している主張の検出を 1 つのコマンドに統合する提案。AI が回答や編集に入る前に、引用可能な根拠束と未解決の論点を同じ枠組みで取得できるようにする。

この提案は旧 `evidence` と `tension` を統合し、`claims` を claim/evidence analysis の共通入口として再定義する。

## 動機

`evidence` と `tension` は一見別機能に見えるが、実際にはどちらも次の共通処理を必要とする。

1. vault から block / section 単位の主張候補を収集する
2. 日付、状態、担当者、定義語を正規化する
3. 問い・主張・文脈との関連度を計算する
4. 支持・反証・未確定・衝突クラスタを分類する
5. 引用位置付きで返す

別コマンドにすると候補抽出・分類・引用整形が二重実装になりやすい。`claims` では「問い駆動で見る」モードと「未解決の衝突を走査する」モードを同じ基盤に載せる。

## コマンド形状

```bash
# 質問に対する根拠束を返す
obsidian plugin-claims question="project X の締切はいつか" top=6 format=json

# 主張に対する支持・反証を集める
obsidian plugin-claims claim="この vault では daily ノートに frontmatter は不要" include=contradicts

# 特定テーマについて未解決の衝突を走査する
obsidian plugin-claims scan query="project X" kinds=status,date,owner unresolved-only format=json

# 起点ノート周辺の衝突を調べ、source of truth 候補も付ける
obsidian plugin-claims scan path=notes/project.md scope=linked suggest-canonical
```

## モードとオプション設計

### 共通

- `context-path=<path>` — 近傍ノートを優先する文脈
- `tag=<tag>` — 対象ノートをタグで絞る
- `folder=<path>` — 対象ノートをフォルダで絞る
- `top=<n>` — 返す件数の上限
- `require-citations` — 引用位置が曖昧な候補を除外する
- `format=json|markdown|text` — 出力形式

### evidence モード

- `question=<text>` — 質問文
- `claim=<text>` — 真偽や妥当性を検証したい主張
- `claim-file=<path>` — 長文の主張や方針文
- `scope=blocks|sections|notes` — 根拠の返却単位
- `include=supports,contradicts,related` — 返すカテゴリ

### scan モード

- `scan` — 衝突走査モード
- `query=<text>` — 特定テーマに関する衝突を探す
- `path=<path>` — 起点ノート
- `scope=note|linked|folder|vault` — 探索範囲
- `kinds=status,date,owner,decision,definition` — 検出したい衝突の種類
- `unresolved-only` — 収束済みクラスタを除外する
- `suggest-canonical` — source of truth 候補を推定して付ける

## 出力例

### evidence モード (`format=text`)

```text
Claims evidence for: "project X の締切はいつか"

supports
  1. notes/project.md#^due-date
     "締切は 2026-05-31 とする"

contradicts
  1. notes/roadmap.md#^milestone
     "project X の最終期限は 2026-06-15"
```

### scan モード (`format=json`)

```json
{
	"query": "project X",
	"clusters": [
		{
			"id": "release-date",
			"kind": "date",
			"severity": "high",
			"status": "unresolved",
			"claims": [
				{
					"path": "notes/project.md",
					"block_id": "deadline",
					"excerpt": "締切は 2026-05-31 とする"
				},
				{
					"path": "notes/roadmap.md",
					"block_id": "milestone",
					"excerpt": "最終期限は 2026-06-15"
				}
			],
			"suggested_canonical": {
				"path": "notes/project.md",
				"block_id": "deadline"
			}
		}
	]
}
```

## 解析戦略

1. `grep` 相当の文字列一致、エイリアス一致、リンク近傍から候補 block を集める
2. 候補から日付、状態、担当者、定義語を抽出し、比較しやすい形に正規化する
3. evidence モードでは `supports` / `contradicts` / `related` に分類する
4. scan モードでは同じエンティティに関する主張をクラスタリングし、`date-conflict` や `status-conflict` を付ける
5. 出典位置と確信度を付けて返し、曖昧なものは低信頼扱いに落とす

ここでの分類は最終判断ではなく、AI が読む順序と警戒箇所を最適化するための前処理とする。

## 責務分離

- `packages/core` — クエリ正規化、主張抽出、値正規化、候補スコアリング、支持/反証/衝突クラスタの分類、出力整形
- `packages/plugin` — vault 内テキスト断片の収集、`MetadataCache` を使ったリンク近傍情報の取得、block 位置解決、CLI adapter

`core` は claim/evidence 分析のロジックを持ち、`plugin` は vault から素材を集める。

## ビルトインとの差分

検索系ワークフローは一致箇所の発見には向くが、「問いに対してどの根拠が支持で、どこが衝突しているか」を整理して返さない。`claims` は AI の判断前に根拠と緊張点を同じ入力形式で渡すためのコマンドである。
