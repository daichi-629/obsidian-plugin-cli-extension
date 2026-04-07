# Feature proposal: inbox

## 概要

CLI やエージェントが見つけた「気づき」「提案」「要確認事項」を Obsidian 内の inbox に貯めておき、ユーザーが GUI で 1 件ずつ消化できるようにする仕組み。

これは編集差分の承認キューではない。vault を直接変更する前提ではなく、「こういう問題がある」「こういう見直しをすると良い」「この 2 つはつながりそう」といった suggestion card を蓄積する。

## 動機

`audit`, `tension`, `serendipity` のような分析系コマンドは、結果をその場の CLI 出力として返すことはできるが、ユーザーが後から Obsidian 上で落ち着いて見返す置き場がない。

また、すべての提案が即座に patch や refactor に落ちるわけではない。まず人間が「これは今見る価値があるか」「後でやるか」「却下するか」を判断したいことが多い。

`inbox` は CLI と GUI の間に非同期な受け皿を作る。CLI 側は suggestion を enqueue するだけ、GUI 側はそれを 1 件ずつ読んで処理するだけ、という責務分離を作る。

## 基本方針

- inbox に入るのは change set ではなく suggestion card
- suggestion card は diff ではなく、要約・根拠・関連ノート・次の行動候補を持つ
- suggestion の生成元は `audit`, `tension`, `serendipity` など複数ありうる
- 保存先は vault 内ファイルではなくプラグイン内部データ
- ユーザー体験の中心は「1 件ずつ消化する inbox UI」

つまり inbox は「変更を承認する場所」ではなく、「AI/CLI が見つけた気づきを人間が捌く場所」である。

## 想定ワークフロー

1. AI や CLI 利用者が分析系コマンドを `enqueue` 付きで実行する
2. コマンドは結果を suggestion card に変換して inbox に保存する
3. ユーザーが Obsidian を開くと inbox に未処理カードが見える
4. ユーザーはカードを 1 件ずつ見て、読む・開く・後回し・却下・完了化する
5. 必要なら、その場で関連ノートを開いたり、タスク化したり、後続コマンドにつなげる

## コマンド形状

```bash
# unresolved link を inbox に積む
obsidian plugin-audit checks=unresolved severity=high enqueue

# 意味的な衝突を inbox に積む
obsidian plugin-tension tag=decision unresolved-only enqueue top=10

# 意外な接続候補を inbox に積む
obsidian plugin-serendipity seed=notes/llm-safety.md enqueue top=5

# 外部エージェントや独自スクリプトが直接カードを追加する
obsidian plugin-inbox add kind=idea title="release note を週報へリンクしませんか" related=notes/release.md,weekly/2026-W15.md

# inbox の未処理カードを確認する
obsidian plugin-inbox list status=open,snoozed

# 1 件の詳細を確認する
obsidian plugin-inbox show id=ibx_20260408_a13f format=json

# CLI からも処理済みにできる
obsidian plugin-inbox resolve id=ibx_20260408_a13f outcome=dismissed
```

## ユーザーフレンドリーな入口

低レベルな `plugin-inbox add` を正面に出すより、既存の分析系コマンドに `enqueue` を足す方が使いやすい。

利用者は「結果をその場で見るか、あとで Obsidian の inbox で見るか」だけを選べばよい。

- その場で見る: 通常どおり `format=text|json`
- あとで見る: 同じコマンドに `enqueue`
- 両方欲しい: `enqueue` しつつ標準出力にも要約を出す

`plugin-inbox add` は外部エージェント、独自スクリプト、将来の未対応コマンド向けの補助線として残す。

## オプション設計

### 分析系コマンド共通

- `enqueue` — 結果を inbox に保存する
- `title-prefix=<text>` — 生成カードのタイトル先頭に文脈ラベルを付ける
- `priority=low|medium|high` — 生成カードの優先度を上書きする
- `limit=<n>` / `top=<n>` — 生成カード数を抑える

必要なら既存の `format=json|text` と併用できる。

### `inbox add`

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

### `inbox resolve`

- `id=<inbox-id>` — 対象カード ID
- `outcome=done|dismissed|snoozed`
- `until=<timestamp>` — `snoozed` 時の再表示時刻

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

この形にしておくと、`audit` の問題カードも、`tension` の未解決論点も、`serendipity` の接続提案も同じ inbox で扱える。

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

- `audit` は issue card の主要な生成元になる
- `tension` は question card の主要な生成元になる
- `serendipity` は idea card の主要な生成元になる
- `impact` や `delta` も review card の生成元になりうる

つまり `inbox` は新しい分析器というより、「既存・将来の提案系コマンドの配信先」である。

## 段階的導入

### Phase 1

`plugin-inbox` 本体、内部ストア、Inbox ビュー、`inbox add/list/show/resolve` を作る。

### Phase 2

`audit` に `enqueue` を追加し、まず構造的な issue を inbox に積めるようにする。

### Phase 3

`tension`, `serendipity` など他の分析系コマンドにも `enqueue` を広げる。

### Phase 4

カードから follow-up action を起動できるようにし、必要なら変更ドラフト機能と接続する。

## 責務分離

- `packages/core` — `SuggestionCard` 型、fingerprint 生成、優先度付け、各コマンド結果から card への正規化、表示用要約の整形
- `packages/plugin` — inbox の内部永続化、GUI ビュー、カード状態更新、関連ノートを開くアクション、各コマンドの `enqueue` フラグ処理

`core` は「どんな suggestion をどんな card にするか」を扱い、`plugin` は「それをどう保存して UI に出すか」を扱う。

## ビルトインとの差分

Obsidian の既存検索や問題一覧は、その場で結果を表示することはできても、「CLI やエージェントが生成した提案をあとで 1 件ずつ消化する persistent inbox」は持たない。

`inbox` は analysis と action の間に非同期な review queue を作る点に独自性がある。
