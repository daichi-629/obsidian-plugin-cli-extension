---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 13
existing_overlap:
  - "grep: 衝突候補の断片検索には使えるが、cluster 化と unresolved 判定はできない"
  - "manual conflict review workflows とは部分重複する"
proposal_overlap:
  - "evidence / claims: claim extraction と contradiction signals を共有する"
  - "narrative: branching / unresolved storyline を共有する"
  - "audit: high-risk issue surfacing の出力先として近い"
integration:
  needed: true
  decision: "単独コマンドとしても残せるが、claims の scan mode に寄せる設計が最も自然"
  cluster: claim-analysis
  shared_with:
    - evidence
    - claims
    - narrative
    - audit
  integrated_proposal: docs/feature-proposals/claims.md
builtin_diff_assessment: "概ね妥当。構造監査と意味的衝突検出は別問題。"
recommendation: "後半フェーズ。誤検出コストが高く、まず evidence 系の基盤を安定させたい。"
---

# Feature proposal: tension

## 概要

同じテーマについて vault 内で衝突している主張、判断、定義、予定を検出し、未解決の緊張点として返すコマンド。AI が編集や要約に入る前に、「何がまだ食い違っているか」を一度で把握できるようにする。

## 動機

現実の vault では、仕様ノートでは「採用」と書かれているのに、会議メモでは「保留」のまま、といった状態が頻繁に起こる。人間は最近の文脈や暗黙知で矛盾を吸収できるが、AI は複数ノートをまたぐ判断の緊張を見落としやすい。

`evidence` は特定の問いや主張に対する支持・反証を集めるコマンドであり、起点の問いが必要である。`audit` は構造的な品質問題を検査するが、意味内容の対立までは扱わない。`tension` は問いを先に与えなくても、「この vault のどこで意見や前提が衝突しているか」を先回りして抽出する。

意味解釈と対立分類を含むため公式 CLI には入りにくいが、自律エージェントが危ない要約や誤った更新を避けるには非常に有効である。

## コマンド形状

```bash
# project X に関する緊張点を列挙する
obsidian plugin-tension query="project X" format=text

# 特定ノートとその周辺リンクにある衝突を調べる
obsidian plugin-tension path=notes/project.md scope=linked include=status,date,owner

# プロジェクトフォルダ全体を対象に、深刻度の高いものだけ返す
obsidian plugin-tension folder=projects severity=high format=json

# 未解決のものだけ返し、暫定的な source of truth 候補も付ける
obsidian plugin-tension tag=decision unresolved-only suggest-canonical
```

## オプション設計

- `query=<text>` — 特定テーマに関する緊張点を探す
- `path=<path>` — 起点ノート
- `folder=<path>` — 対象フォルダを絞る
- `tag=<tag>` — 対象ノートをタグで絞る
- `scope=note|linked|folder|vault` — どこまで探索するか（デフォルト: `linked`）
- `include=status,date,owner,decision,definition` — 対立の種類
- `severity=low|medium|high` — 返す深刻度の下限
- `unresolved-only` — すでに収束済みの緊張点を除外する
- `suggest-canonical` — source of truth 候補を推定して付与する
- `top=<n>` — 返す件数の上限
- `format=text|markdown|json` — 出力形式（デフォルト: `text`）

## 出力例

### `format=text`

```text
Tensions for: "project X"

1. release-date
   severity: high
   status: unresolved
   notes/project.md#^deadline
     "締切は 2026-05-31 とする"
   notes/roadmap.md#^milestone
     "最終期限は 2026-06-15"
   signals: shared-entity, date-conflict, both-authoritative

2. api-policy
   severity: medium
   status: unresolved
   meetings/2026-04-01.md#^api
     "REST を採用する"
   daily/2026-04-03.md#^revisit
     "GraphQL を再検討する"
   suggested-canonical: notes/architecture.md#^api
```

### `format=json`

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
					"excerpt": "締切は 2026-05-31 とする",
					"stance": "asserts",
					"confidence": 0.91
				},
				{
					"path": "notes/roadmap.md",
					"block_id": "milestone",
					"excerpt": "最終期限は 2026-06-15",
					"stance": "asserts",
					"confidence": 0.88
				}
			],
			"signals": ["shared-entity", "date-conflict", "authoritative-location"],
			"suggested_canonical": {
				"path": "notes/project.md",
				"block_id": "deadline",
				"reason": "more recent + closer to project hub"
			}
		}
	]
}
```

## 検出戦略

1. 対象範囲から主張候補をブロック単位で抽出する
2. 日付、状態、担当者、採否、定義語を正規化して比較しやすい形に落とす
3. 同じエンティティに関する主張同士を束ね、`date-conflict`、`status-conflict`、`owner-conflict`、`definition-conflict` などに分類する
4. 明示的な解消表現（`決定済み`, `obsolete`, `superseded by` など）があれば収束済みとして減点する
5. `suggest-canonical` 指定時は、更新時刻、リンク集中度、ファイル種別、決定語彙を使って source of truth 候補を推定する

ここでの tension は論理的矛盾の厳密証明ではなく、「AI が鵜呑みにすると危ない衝突箇所」を先に浮かび上がらせるための警告層とする。

## 責務分離

- `packages/core` — 主張抽出、値正規化、衝突クラスタリング、深刻度推定、canonical 候補スコアリング、出力整形
- `packages/plugin` — vault からのテキスト断片収集、frontmatter / block 参照 / リンク近傍情報の取得、CLI adapter

`core` は主張とメタデータの集合を受け取り、意味的な緊張検出ロジックだけを担当する。

## ビルトインとの差分

`grep` や `search` は一致箇所を返すだけで、主張間の対立を束ねない。`audit` は構造的問題を見るが、意味内容の衝突は扱わない。`evidence` は問いに対する根拠整理であり、vault 全体の未解決論点を自動抽出するものではない。

`tension` は「答えを作る前に、どこがまだ割れているかを知る」ためのコマンドである点に独自性がある。
