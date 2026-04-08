---
reviewed_at: 2026-04-08
impact: medium
priority_rank: 5
existing_overlap:
    - "grep / apply-patch: persistent review queue や GUI inbox は提供していない"
proposal_overlap:
    - "audit: issue card の有力な供給元"
    - "tension / claims: question card の有力な供給元"
    - "serendipity: idea card の有力な供給元"
    - "impact / delta: review card の有力な供給元"
integration:
    needed: true
    decision: "まずは `plugin-inbox` 単体で導入し、後から分析コマンドや agent workflow の producer を足せる受け皿として設計する"
    cluster: review-queue
    shared_with:
        - audit
        - tension
        - claims
        - serendipity
        - impact
        - delta
    integrated_proposal: null
builtin_diff_assessment: "妥当。既存のその場限りの結果表示とは別に、非同期 review queue という明確な差がある。"
recommendation: "優先度を上げる。分析コマンドが揃っていなくても、AI やユーザーが提案を蓄積・消化する単独 workflow として価値がある。"
---

# Feature proposal: inbox

## 概要

CLI、エージェント、あるいはユーザー自身が作った「気づき」「提案」「要確認事項」を Obsidian 内の inbox に貯めておき、あとから 1 件ずつ消化できるようにする仕組み。

これは編集差分の承認キューではない。vault を直接変更する前提ではなく、「こういう問題がある」「こういう見直しをすると良い」「この 2 つはつながりそう」といった suggestion card を蓄積する。

## 動機

Obsidian 上で思いついた改善案、AI が会話中に出した提案、外部スクリプトが生成した review メモは、その場では有用でも後で見返す場所がないとすぐ流れてしまう。

また、すべての提案が即座に patch や refactor に落ちるわけではない。まず人間が「これは今見る価値があるか」「後でやるか」「却下するか」を判断したいことが多い。

`inbox` は proposal 自体を first-class object として扱う。分析コマンドがまだ揃っていなくても、`plugin-inbox` 単体で「提案を残す」「見返す」「処理状態を変える」という workflow を成立させられる。

## 基本方針

- inbox に入るのは change set ではなく suggestion card
- suggestion card は diff ではなく、要約・根拠・関連ノート・次の行動候補を持つ
- suggestion の生成元は手動入力、agent、外部スクリプト、分析コマンドなど複数ありうる
- 保存先は vault 内ファイルではなくプラグイン内部データ
- ユーザー体験の中心は「1 件ずつ消化する inbox UI」

つまり inbox は「変更を承認する場所」ではなく、「AI/CLI が見つけた気づきを人間が捌く場所」である。

## 想定ワークフロー

1. AI、CLI 利用者、またはユーザーが inbox に card を作る
2. ユーザーが Obsidian を開くと inbox に未処理カードが見える
3. ユーザーはカードを 1 件ずつ見て、読む・開く・後回し・却下・完了化する
4. 必要なら、その場で関連ノートを開いたり、タスク化したり、後続コマンドにつなげる

## コマンド形状

```bash
# 新しい提案カードを作る
obsidian plugin-inbox create kind=idea title="release note を週報へリンクしませんか" related=notes/release.md,weekly/2026-W15.md

# inbox の未処理カードを確認する
obsidian plugin-inbox list status=open,snoozed

# 1 件の詳細を確認する
obsidian plugin-inbox show id=ibx_20260408_a13f format=json

# CLI から状態や内容を更新する
obsidian plugin-inbox update id=ibx_20260408_a13f status=dismissed

# 不要なカードを削除する
obsidian plugin-inbox delete id=ibx_20260408_a13f
```

## MVP の command surface

MVP は CRUD と分類・処理状態だけに寄せる。

- `create` — 新しい suggestion card を作る
- `list` — `kind` / `status` / `priority` で絞って並べる
- `show` — 1 件の詳細を見る
- `update` — `status` や本文、優先度を変える
- `delete` — 不要カードを消す

分析系コマンドからの投入は後から `plugin-inbox create` の wrapper として追加すれば足りる。

## オプション設計

### `inbox create`

- `kind=issue|question|idea|review` — カード種別
- `title=<text>` — 一覧に出る短いタイトル
- `summary=<text>` — 本文サマリ
- `related=<path[,path...]>` — 関連ノート
- `priority=low|medium|high`
- `source=<text>` — 生成元のラベル

### `inbox list`

- `status=open|snoozed|done|dismissed` — 状態で絞り込む。複数指定可
- `kind=issue|question|idea|review` — 種別で絞り込む
- `priority=low|medium|high` — 優先度で絞り込む
- `limit=<n>` — 表示件数
- `format=text|json`

### `inbox show`

- `id=<inbox-id>` — 対象カード ID
- `format=text|json`

### `inbox update`

- `id=<inbox-id>` — 対象カード ID
- `status=open|snoozed|done|dismissed` — 処理状態
- `kind=issue|question|idea|review` — 種別変更
- `priority=low|medium|high` — 優先度変更
- `title=<text>` — タイトル更新
- `summary=<text>` — 本文更新
- `until=<timestamp>` — `snoozed` 時の再表示時刻

### `inbox delete`

- `id=<inbox-id>` — 対象カード ID

## suggestion card の形

inbox に積む単位は、ファイル変更ではなく suggestion card とする。

```ts
type SuggestionCard = {
	id: string;
	status: "open" | "snoozed" | "done" | "dismissed";
	kind: "issue" | "question" | "idea" | "review";
	priority: "low" | "medium" | "high";
	title: string;
	summary: string;
	source: {
		command: string;
		runAt: string;
	};
	relatedPaths: string[];
	evidence?: Array<{
		path: string;
		blockId?: string;
		excerpt?: string;
	}>;
	suggestedActions?: Array<{
		label: string;
		action: "open-note" | "open-search" | "create-task" | "run-followup";
		payload?: Record<string, string>;
	}>;
	fingerprint: string;
	seenCount: number;
	createdAt: string;
	updatedAt: string;
	snoozedUntil?: string;
};
```

この形にしておくと、手動追加のメモ、agent の提案、`audit` の問題カード、`serendipity` の接続提案を同じ inbox で扱える。

## カードの例

### unresolved link 由来の `issue`

```json
{
	"id": "ibx_20260408_a13f",
	"status": "open",
	"kind": "issue",
	"priority": "high",
	"title": "Unresolved link in notes/project.md",
	"summary": "[[missing-spec]] へのリンク先が存在しません。",
	"source": {
		"command": "plugin-audit",
		"runAt": "2026-04-08T12:00:00.000Z"
	},
	"relatedPaths": ["notes/project.md"],
	"evidence": [
		{
			"path": "notes/project.md",
			"excerpt": "[[missing-spec]]"
		}
	],
	"suggestedActions": [
		{ "label": "Open note", "action": "open-note", "payload": { "path": "notes/project.md" } },
		{ "label": "Create task", "action": "create-task" }
	],
	"fingerprint": "audit:unresolved:notes/project.md:[[missing-spec]]",
	"seenCount": 1,
	"createdAt": "2026-04-08T12:00:00.000Z",
	"updatedAt": "2026-04-08T12:00:00.000Z"
}
```

### serendipity 由来の `idea`

```json
{
	"id": "ibx_20260408_b58a",
	"status": "open",
	"kind": "idea",
	"priority": "medium",
	"title": "notes/llm-safety.md と release checklist を結ぶ候補",
	"summary": "段階的公開とロールバック条件の観点で 2 つのノートを橋渡しできそうです。",
	"source": {
		"command": "plugin-serendipity",
		"runAt": "2026-04-08T12:10:00.000Z"
	},
	"relatedPaths": ["notes/llm-safety.md", "notes/release-checklist.md"],
	"fingerprint": "serendipity:notes/llm-safety.md:notes/release-checklist.md",
	"seenCount": 1,
	"createdAt": "2026-04-08T12:10:00.000Z",
	"updatedAt": "2026-04-08T12:10:00.000Z"
}
```

## GUI フロー

MVP では専用の「Inbox」ビューを追加する。体験の中心は一覧よりも「次の 1 件」に寄せる。

1 件のカードでは少なくとも次を見せる:

- タイトル、種別、優先度、生成元
- 要約
- 関連ノート一覧
- 根拠となる抜粋や参照先
- 推奨アクション
- `Open` / `Done` / `Snooze` / `Dismiss` / `Next` の操作

一覧ビューは補助とし、メイン UI は「今見るべきカードを 1 件出す」形にする。

## 1 件ずつ消化するための状態

- `open` — 未処理
- `snoozed` — 後で再表示
- `done` — 価値を回収した
- `dismissed` — 不要と判断した

`done` は「提案に従って編集した」だけでなく、「確認して把握した」「もう十分」といった完了も含める。

## 重複抑制

queue 型の機能では、同じ提案が何度も積まれるとすぐに使い物にならなくなる。MVP でも重複抑制は必須である。

1. 各カードに `fingerprint` を持たせる
2. 同じ fingerprint の未処理カードがある場合は新規作成せず `seenCount` と `updatedAt` を更新する
3. `dismissed` 直後のカードは一定期間は再生成を抑制する
4. ただし優先度が上がったり根拠が増えた場合は再オープンできる

## 後続アクション

inbox 自体は編集コマンドではないが、後続アクションの起点にはなれる。

例えばカードから次を起動できる:

- 関連ノートを開く
- 検索を開く
- Daily note や task list にタスク化する
- 将来的には `apply-patch propose` や `refactor propose` のような変更ドラフト生成につなぐ

重要なのは、inbox に入る時点ではまだ変更を確定させないことである。

## 既存提案との関係

- `audit` は issue card の有力な生成元になる
- `tension` は question card の有力な生成元になる
- `serendipity` は idea card の有力な生成元になる
- `impact` や `delta` も review card の生成元になりうる

ただし `inbox` の価値は producer が揃ってから初めて発生するわけではない。まずは proposal を保存・分類・消化する独立 surface として成立させ、その後に他コマンドの配信先として広げればよい。

## 段階的導入

### Phase 1

`plugin-inbox` 本体、内部ストア、Inbox ビュー、`inbox create/list/show/update/delete` を作る。

### Phase 2

外部エージェントやローカルスクリプトから `plugin-inbox create` を叩いて card を追加できるようにする。

### Phase 3

`audit`, `tension`, `serendipity` など既存・将来の提案系コマンドから inbox へ投入できるようにする。

### Phase 4

カードから follow-up action を起動できるようにし、必要なら変更ドラフト機能と接続する。

## 責務分離

- `packages/core` — `SuggestionCard` 型、fingerprint 生成、優先度付け、表示用要約の整形
- `packages/plugin` — inbox の内部永続化、GUI ビュー、card の CRUD、関連ノートを開くアクション、将来の producer 接続

`core` は card モデルと共通ロジックを扱い、`plugin` はそれをどう保存して UI に出すかを扱う。

## ビルトインとの差分

Obsidian の既存検索や問題一覧は、その場で結果を表示することはできても、「CLI やエージェントが生成した提案をあとで 1 件ずつ消化する persistent inbox」は持たない。

`inbox` は proposal を persistent に保持し、`kind` と `status` で人間が消化できる review queue を作る点に独自性がある。
