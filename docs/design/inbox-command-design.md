# Inbox command design

## 目的

Obsidian CLI 拡張として `inbox` command 群を追加し、CLI・エージェント・ユーザー自身が作った「気づき」「提案」「要確認事項」を Obsidian 内部の persistent queue に蓄積し、あとから 1 件ずつ消化できるようにする。

この設計は [`inbox` proposal](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/feature-proposals/research/inbox.md) を具体化したものであり、将来の `audit` / `serendipity` / `tension` などの分析コマンドが共通の配信先として使えるストアを先に確立することを目的とする。

狙いは次の 5 点。

- `SuggestionCard` を first-class object として CRUD できる CLI surface を作る
- fingerprint による重複抑制を core 層に持ち、queue が汚染されるのを防ぐ
- card の生成元 (hand/agent/command) によらず同じデータモデルで扱えるようにする
- `packages/core` に card ロジックを、`packages/plugin` に Obsidian 永続化と GUI ビューを分離する
- `main.ts` に command registration 以上の責務を持ち込まない

## Summary

`inbox` は 1 つの多機能 command ではなく、操作ごとに別 command として公開する。

- `excli-inbox:create`
    - 新しい suggestion card を inbox に追加する
    - fingerprint が一致する open/snoozed card がある場合は `seenCount` と `updatedAt` を更新して既存カードの ID を返す
- `excli-inbox:list`
    - `status` / `kind` / `priority` で絞り込んで card 一覧を返す
- `excli-inbox:show`
    - 1 件の card 詳細を返す
- `excli-inbox:update`
    - card の `status` / `kind` / `priority` / `title` / `summary` / `snoozedUntil` を変更する
- `excli-inbox:delete`
    - card を完全削除する

### Goals

- `create` / `list` / `show` / `update` / `delete` の CRUD を CLI から安定して実行できる
- `kind` / `status` / `priority` / `source` / `relatedPaths` / `evidence` / `suggestedActions` / `fingerprint` を持つ `SuggestionCard` を格納できる
- fingerprint による重複抑制を実装し、同じ提案の重複積み上げを防ぐ
- `dismissed` カードの再生成抑制期間を設計する
- `create` / `list` / `show` / `update` の出力を `text` / `json` で安定して返せる
- card ロジックと fingerprint 処理を `packages/core` の純粋関数として unit test できる
- `packages/plugin` に Obsidian 永続化と GUI ビューを集約する
- 将来の `audit` / `serendipity` / `tension` が `plugin-inbox create` の wrapper として card を追加できる設計にする
- Focus モード（1 件ずつ消化）と List モード（絞り込み一覧）を持つ `InboxView` を提供する
- summary の markdown を `MarkdownRenderer.render()` で表示し、wikilink をクリックで note を開けるようにする
- `snoozedUntil` を過ぎた card を view 起動時に自動で `open` に戻す

### Non-goals

- vault ファイルへの直接書き出し（保存先は plugin 内部データのみ）
- card の diff/patch 自動適用（inbox は変更を確定させる場所ではない）
- card からの follow-up action 起動（Phase 4 スコープ）
- `list` の全フィールド検索や全文検索
- card のエクスポート・インポート
- タグや folder による card の分類（card は vault-facing metadata を持たない）
- summary の編集 UI（view は read-only）

## 仕様設計

### Command shape

公開 command は次の 5 つとする。

```text
obsidian excli-inbox:create kind=<issue|question|idea|review> title=<text> [summary=<text>] [related=<path[,path...]>] [priority=<low|medium|high>] [source=<text>] [fingerprint=<text>] [format=<text|json>]
obsidian excli-inbox:list [status=<open|snoozed|done|dismissed[,...]>] [kind=<issue|question|idea|review>] [priority=<low|medium|high>] [limit=<n>] [format=<text|json>]
obsidian excli-inbox:show id=<inbox-id> [format=<text|json>]
obsidian excli-inbox:update id=<inbox-id> [status=<open|snoozed|done|dismissed>] [kind=<issue|question|idea|review>] [priority=<low|medium|high>] [title=<text>] [summary=<text>] [until=<iso8601>] [format=<text|json>]
obsidian excli-inbox:delete id=<inbox-id>
```

`format` は `text` を default とする。すべての command は stdout に machine-readable payload を、stderr に error を出す。

### Naming

- directory 名: `inbox`
- plugin command ID:
    - `inbox:create`
    - `inbox:list`
    - `inbox:show`
    - `inbox:update`
    - `inbox:delete`
- CLI 名:
    - `excli-inbox:create`
    - `excli-inbox:list`
    - `excli-inbox:show`
    - `excli-inbox:update`
    - `excli-inbox:delete`

`excli-inbox` 単体 command は登録しない。

### Option semantics

#### `inbox create`

- `kind=issue|question|idea|review`
    - card 種別。required
- `title=<text>`
    - 一覧に出る短いタイトル。required
- `summary=<text>`
    - 本文サマリ。optional、省略時は空文字
- `related=<path[,path...]>`
    - 関連ノートの vault-relative path をカンマ区切りで指定する
    - 指定パスは存在確認を行わない（将来 audit がリンク切れを検出する）
- `priority=low|medium|high`
    - default は `medium`
- `source=<text>`
    - 生成元のラベル文字列。省略時は `cli`
- `fingerprint=<text>`
    - 重複抑制に使う識別文字列。省略時はシステムが `title` から生成する
- `format=text|json`
    - default `text`

#### `inbox list`

- `status=open|snoozed|done|dismissed`
    - カンマ区切りで複数指定可
    - 省略時は `open,snoozed`（未処理のもの）
- `kind=issue|question|idea|review`
    - 単一値のみ。省略時は全種別
- `priority=low|medium|high`
    - 単一値のみ。省略時は全優先度
- `limit=<n>`
    - 正の整数。省略時は制限なし
- `format=text|json`
    - default `text`

結果の並び順は priority 降順（high > medium > low）、次に `createdAt` 昇順とし、決定論的に安定させる。

#### `inbox show`

- `id=<inbox-id>`
    - 対象 card の ID。required
- `format=text|json`
    - default `text`

#### `inbox update`

- `id=<inbox-id>`
    - 対象 card の ID。required
- `status=open|snoozed|done|dismissed`
    - 処理状態の更新。optional
- `kind=issue|question|idea|review`
    - 種別の変更。optional
- `priority=low|medium|high`
    - 優先度の変更。optional
- `title=<text>`
    - タイトルの更新。optional
- `summary=<text>`
    - 本文の更新。optional
- `until=<iso8601>`
    - `status=snoozed` のときの再表示時刻。他の status 指定時は usage error
- `format=text|json`
    - default `text`

update では変更フィールドのみ上書きする。指定しなかったフィールドは変更しない。`updatedAt` は常に更新する。

#### `inbox delete`

- `id=<inbox-id>`
    - 対象 card の ID。required

delete は stdout に確認出力なしで削除を実行し、成功時は exit 0 を返す。`format` は受け付けない。

### Fingerprint and deduplication

重複抑制の目的は「同一起源の提案が何度でも queue に積まれる」状態を防ぐことである。

#### Fingerprint の生成規則

caller が `fingerprint` を指定した場合はそれを使用する。省略時は次の形式で生成する。

```
<source>:<title-slug>
```

- `source` は生成元ラベル（例: `plugin-audit`, `cli`）
- `title-slug` は `title` を小文字化し空白・特殊文字をハイフンに置換したもの

将来の `audit` 等は意味のある fingerprint を明示的に渡すことを推奨する（例: `audit:unresolved:notes/project.md:[[missing-spec]]`）。

#### 重複判定ルール

`create` 実行時に次の手順で重複を判定する。

1. 同じ `fingerprint` を持つ card を store から検索する
2. 見つかった card の `status` が `open` または `snoozed` の場合は「既存 card に集約」する
    - `seenCount` を +1
    - `updatedAt` を現在時刻に更新
    - 既存 card の ID を create の結果として返す
3. 見つかった card の `status` が `done` の場合は新規 card を作成する
4. 見つかった card の `status` が `dismissed` の場合は再生成抑制を適用する
    - `dismissedAt` から `dismissCooldownDays` 日未満の場合は新規作成を行わず、既存 card の ID を返す
    - 期間を超えた場合は新規 card として作成する（再表出として扱う）

`dismissCooldownDays` は plugin settings で設定可能とし、default は `7` 日とする。

### SuggestionCard data model

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
		runAt: string; // ISO 8601
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
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
	snoozedUntil?: string; // ISO 8601、status=snoozed のときのみ
	dismissedAt?: string; // ISO 8601、status=dismissed のときのみ
};
```

`evidence` と `suggestedActions` は CLI の `create` では指定できない（外部スクリプトや将来の producer が直接投入する用途のフィールド）。CLI 経由 create では両フィールドを省略 (undefined) で作成する。

### ID 形式

card ID は次の形式とする。

```
ibx_YYYYMMDD_XXXX
```

- `YYYYMMDD` は card 作成日（UTC）
- `XXXX` は衝突回避のための 4 桁小文字 hex（crypto ランダム）

例: `ibx_20260408_a13f`

### JSON contracts

#### `create` の成功レスポンス

```ts
type InboxCreateResult =
	| {
			created: true;
			card: SuggestionCard;
	  }
	| {
			created: false;
			reason: "duplicate_open" | "duplicate_dismissed_cooldown";
			card: SuggestionCard; // 既存 card（seenCount 更新後）
	  };
```

`text` 形式では新規作成時に `Created: <id>` を、重複時に `Already exists (id=<id>, seenCount=<n>): skipped.` を返す。

#### `list` のレスポンス

```ts
type InboxListResult = {
	filter: {
		status: ("open" | "snoozed" | "done" | "dismissed")[];
		kind: string | null;
		priority: string | null;
		limit: number | null;
	};
	totalCount: number; // filter 前の store 全件数
	displayedCount: number; // filter + limit 後の件数
	cards: InboxCardSummary[];
};

type InboxCardSummary = {
	id: string;
	status: string;
	kind: string;
	priority: string;
	title: string;
	createdAt: string;
	seenCount: number;
};
```

`text` 形式では 1 行 1 card の compact 表示を返す。

```text
[open/high]  ibx_20260408_a13f  Unresolved link in notes/project.md
[open/medium] ibx_20260408_b58a  notes/llm-safety.md と release checklist を結ぶ候補
2 cards (total: 5)
```

#### `show` のレスポンス

`format=json` では `SuggestionCard` をそのまま返す。
`format=text` では次の形式で返す。

```text
ID:        ibx_20260408_a13f
Kind:      issue
Status:    open
Priority:  high
Title:     Unresolved link in notes/project.md
Summary:   [[missing-spec]] へのリンク先が存在しません。
Source:    plugin-audit (2026-04-08T12:00:00.000Z)
Related:   notes/project.md
Seen:      1
Created:   2026-04-08T12:00:00.000Z
```

#### `update` のレスポンス

`format=json` では更新後の `SuggestionCard` をそのまま返す。
`format=text` では `Updated: <id>` を返す。

### Input validation

#### Common

- `excli-inbox` 単体 command は登録しない
- unknown `excli-inbox:*` command は registration されない
- `format` は `text`, `json` 以外で usage error

#### `create`

- `kind` と `title` は required。なければ usage error
- `priority` は `low|medium|high` 以外で usage error
- `related` の各パスが空文字であれば usage error（パスの存在確認は行わない）

#### `list`

- `status` の各要素が `open|snoozed|done|dismissed` 以外で usage error
- `limit` は正の整数でなければ usage error

#### `show`

- `id` は required。なければ usage error

#### `update`

- `id` は required。なければ usage error
- 変更フィールドが 1 つもない場合は usage error
- `until` は `status=snoozed` と一緒に指定するか、現在の status が `snoozed` のときのみ有効。他の status 指定と組み合わせた場合は usage error
- `until` は ISO 8601 形式でなければ usage error

#### `delete`

- `id` は required。なければ usage error

### Error model

error は 3 類型とする。

- usage error
    - 不正 option、必須引数欠落、組み合わせ違反
- not-found error
    - 指定 `id` の card が存在しない場合
- execution error
    - store の読み書き失敗など runtime エラー

`id not found` は command failure (exit 1) とする（traverse の「path not found」と異なり、存在しない ID を指定することは使用者のミスとみなす）。

### Process contract

- machine-readable payload と通常 formatter 出力は stdout に出す
- usage error や runtime error の診断メッセージは stderr に出す
- exit code は次で固定する
    - `0`: 正常終了（create で重複 skip の場合も含む）
    - `2`: usage error
    - `3`: runtime error（store 読み書き失敗など）
    - `4`: not-found error（指定 id の card がない）

### GUI Inbox View

#### 概要

`InboxView` は Obsidian の `ItemView` として実装し、right sidebar leaf に表示する。体験の中心は「次の 1 件を消化する」Focus モードであり、List モードはその補助とする。

#### View 識別子

- view type: `excli-inbox-view`
- ribbon icon: `inbox` アイコン（クリックで view を開く）
- コマンドパレット登録名: `Inbox: Open Inbox View`

#### Focus モード（主）

1 件の card を全幅で表示し、操作ボタンで消化する。

```
┌────────────────────────────────────────┐
│ [Focus] [List]           ◀ 3 / 7 ▶   │
├────────────────────────────────────────┤
│ [idea] medium  ● open                  │
│ notes/llm-safety.md と release を結ぶ候補 │
├────────────────────────────────────────┤
│ 段階的公開とロールバック条件の観点で        │
│ 2 つのノートを橋渡しできそうです。         │
│ [[notes/llm-safety]] を参照。           │  ← MarkdownRenderer
├────────────────────────────────────────┤
│ Related  notes/llm-safety.md           │
│          notes/release-checklist.md    │
│ Source   plugin-serendipity · 04-08    │
├────────────────────────────────────────┤
│  [Open]  [✓ Done]  [⏰ Snooze]  [✗ Dismiss] │
└────────────────────────────────────────┘
```

- `◀ / ▶` で同一 status filter 内の前後 card に移動する
- `N / M` は現在位置とフィルタ後件数
- `[Open]` は `relatedPaths[0]` を `app.workspace.openLinkText()` で開く（複数 related があるときはドロップダウン）
- `[Done]` / `[Dismiss]` は即時 status 変更 → store 保存 → 次 card に進む
- `[Snooze]` はドロップダウンで `1h / 3h / 明日 / 1 週間` を選択し `snoozedUntil` を設定する
- header の `● open` / `⏰ snoozed` 等はクリックで status を直接変更できる

#### List モード（補助）

絞り込んだ card をスクロール可能な一覧で表示する。

```
┌────────────────────────────────────────┐
│ [Focus] [List]  Status [open▼]  Kind [all▼] │
├────────────────────────────────────────┤
│ ● [H] ibx_...a13f  Unresolved link in notes/project.md  │
│ ○ [M] ibx_...b58a  llm-safety と release を結ぶ候補     │
│ ○ [L] ibx_...c91d  weekly/2026-W15 のリンク切れ         │
├────────────────────────────────────────┤
│ 3 / 7 open cards                      │
└────────────────────────────────────────┘
```

- 各行クリックで Focus モードに切り替えてそのカードを表示する
- status / kind のドロップダウンでフィルタを変更する
- priority badge `[H/M/L]` は高・中・低を示す

#### Markdown レンダリング

summary フィールドは `MarkdownRenderer.render()` で HTML に展開する。

```ts
await MarkdownRenderer.render(
	this.app,
	card.summary,
	summaryContainer,
	"", // sourcePath (relative link の解決基準。空文字で vault root 基準)
	this // component (リンクイベントの lifecycle を view に紐付ける)
);
```

- wikilink `[[note]]` はクリックで `app.workspace.openLinkText()` を呼び出すリンクになる
- CodeMirror は **使わない**。`MarkdownRenderer` は read-only な HTML 展開のみを行い、エディタ機能を持ち込まない
- re-render 時は `summaryContainer.empty()` で前回の DOM を破棄してから再度 `render()` を呼ぶ

#### snoozed カードの自動遷移

view の `onOpen()` と `registerInterval(window.setInterval(...), 60_000)` で毎分チェックする。

```ts
private checkSnoozedCards(now: Date): void {
  const cards = this.store.loadCardsSync();
  const toWake = cards.filter(
    (c) => c.status === "snoozed" && c.snoozedUntil && new Date(c.snoozedUntil) <= now
  );
  if (toWake.length > 0) {
    const updated = cards.map((c) =>
      toWake.includes(c)
        ? { ...c, status: "open" as const, snoozedUntil: undefined, updatedAt: now.toISOString() }
        : c
    );
    this.store.saveCardsSync(updated);
    this.refresh();
  }
}
```

`InboxStoreManager` には `loadCardsSync()` / `saveCardsSync()` の同期 variant を追加するか、interval コールバックを async に変更して通常の `loadCards()` / `saveCards()` を使う（後者を推奨）。

#### store 変更の反映

CLI から `excli-inbox:*` が実行されて store が変わっても view は自動では気づかない。view 側で「Refresh」ボタンを設けるか、view が active なときは CLI handler 実行後に `InboxView.refresh()` を呼ぶよう handler 側からイベントを伝播する。v1 は手動 Refresh ボタンで対応し、自動伝播は deferred とする。

## 詳細設計

### Data store model

#### Store schema

plugin 内部データに `inboxStore` キーを追加し、既存の設定データと並列に保存する。

```ts
type InboxStore = {
	version: 1;
	cards: SuggestionCard[];
};
```

`settings/index.ts` の `StoredPluginSettings` に `inboxStore?: unknown` を追加し、`loadPluginSettings` と `savePluginSettings` が inbox データを透過的に保持するようにする。ただし inbox store の読み書き API は独立した `InboxStoreManager` として分離し、設定ロジックと混在させない。

#### `InboxStoreManager`

plugin 側に `src/inbox/InboxStoreManager.ts` を置く。これは plugin instance を参照し、`loadData()` / `saveData()` 経由で inbox store を読み書きする adapter である。

```ts
interface InboxStoreManager {
	loadCards(): Promise<SuggestionCard[]>;
	saveCards(cards: SuggestionCard[]): Promise<void>;
}
```

core 層の CRUD logic は `SuggestionCard[]` の純粋な配列操作として実装し、`InboxStoreManager` とは分離する。これにより core のテストは store adapter なしで実行できる。

### Card lifecycle

```
create ──► open
               │
               ├─ update(status=snoozed, until=T) ──► snoozed ──► (T 経過後 UI が open に戻す)
               │
               ├─ update(status=done) ──► done
               │
               └─ update(status=dismissed) ──► dismissed
                                                │
                                                └─ (cooldown 経過後に同 fingerprint の create) ──► open (新 card)
```

`snoozed` から `open` への自動遷移は GUI ビュー側が担う（CLI は `snoozedUntil` の更新のみ行い、自動遷移は実施しない）。

### Fingerprint generation

```ts
function generateFingerprint(source: string, title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "");
	return `${source}:${slug}`;
}
```

caller 提供の fingerprint はそのまま使用し、上記関数を呼ばない。

### ID generation

```ts
function generateCardId(now: Date): string {
	const date = now.toISOString().slice(0, 10).replace(/-/g, "");
	const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `ibx_${date}_${hex}`;
}
```

`packages/core` に配置し、`crypto` は Web Crypto API (`globalThis.crypto`) を使うことで Obsidian / Node.js 両環境で動作させる。

### CRUD logic in core

`packages/core/src/commands/inbox/` に次の純粋関数を置く。

#### `executeCreate`

```ts
type CreateInput = {
	kind: SuggestionCard["kind"];
	title: string;
	summary: string;
	relatedPaths: string[];
	priority: SuggestionCard["priority"];
	source: string;
	fingerprint: string;
	now: Date;
	dismissCooldownDays: number;
};

function executeCreate(
	cards: SuggestionCard[],
	input: CreateInput
): { cards: SuggestionCard[]; result: InboxCreateResult };
```

- fingerprint 一致 card を `cards` から検索する
- 重複判定ルールに従い、新規追加 or 既存更新の操作を行う
- 更新後の cards 配列と result を返す（副作用なし）

#### `executeList`

```ts
type ListInput = {
	status: SuggestionCard["status"][];
	kind: SuggestionCard["kind"] | null;
	priority: SuggestionCard["priority"] | null;
	limit: number | null;
};

function executeList(cards: SuggestionCard[], input: ListInput): InboxListResult;
```

- filter → sort (priority 降順, createdAt 昇順) → limit の順に処理する
- priority の順序は `high > medium > low` とし、文字列ソートではなく明示的な順序マップを使う

#### `executeShow`

```ts
function executeShow(cards: SuggestionCard[], id: string): SuggestionCard | null;
```

#### `executeUpdate`

```ts
type UpdateInput = {
	id: string;
	status?: SuggestionCard["status"];
	kind?: SuggestionCard["kind"];
	priority?: SuggestionCard["priority"];
	title?: string;
	summary?: string;
	snoozedUntil?: string;
	now: Date;
};

function executeUpdate(
	cards: SuggestionCard[],
	input: UpdateInput
): { cards: SuggestionCard[]; updated: SuggestionCard | null };
```

- `status=dismissed` に変更する場合は `dismissedAt` を `now` に設定する
- `status=snoozed` に変更する場合は `snoozedUntil` を `input.snoozedUntil` に設定する
- `snoozedUntil` を持つ card を `status=open` に戻す場合は `snoozedUntil` を削除する

#### `executeDelete`

```ts
function executeDelete(
	cards: SuggestionCard[],
	id: string
): { cards: SuggestionCard[]; deleted: boolean };
```

### Formatters

`packages/core/src/commands/inbox/` に `format*.ts` を置く。

- `formatCreate.ts` — `InboxCreateResult` → `text | json` 文字列
- `formatList.ts` — `InboxListResult` → `text | json` 文字列
- `formatShow.ts` — `SuggestionCard | null` → `text | json` 文字列
- `formatUpdate.ts` — `SuggestionCard | null` → `text | json` 文字列

text formatter の方針:

- `list`: `[status/priority]  id  title` の 1 行 compact 形式
- `show`: key-value 形式（`evidence` / `suggestedActions` は要約行のみ）
- `create` / `update`: 1 行メッセージ

### Proposed structure

```text
docs/
  design/
    inbox-command-design.md

packages/
  core/
    src/
      commands/
        inbox/
          index.ts
          types.ts
          executeCreate.ts
          executeList.ts
          executeShow.ts
          executeUpdate.ts
          executeDelete.ts
          generateCardId.ts
          generateFingerprint.ts
          formatCreate.ts
          formatList.ts
          formatShow.ts
          formatUpdate.ts
    __tests__/
      commands/
        inbox/
          executeCreate.test.ts
          executeList.test.ts
          executeUpdate.test.ts
          executeDelete.test.ts
          generateFingerprint.test.ts
          formatList.test.ts
          formatShow.test.ts

  plugin/
    src/
      inbox/
        InboxStoreManager.ts    # plugin.loadData/saveData adapter
        InboxView.ts            # ItemView (Focus + List mode)
        inboxSettings.ts        # dismissCooldownDays などの設定型
      commands/
        inbox/
          index.ts
          types.ts
          spec.ts
          parseCliArgs.ts
          registerCliHandler.ts
```

### Responsibilities

#### `packages/core/src/commands/inbox/`

Obsidian 非依存の card ロジックを置く。

- `SuggestionCard` 型定義
- fingerprint 生成と重複判定
- ID 生成（Web Crypto API ベース）
- CRUD 純粋関数（cards 配列 in/out）
- priority sort 順序定義
- text/json formatter

#### `packages/plugin/src/inbox/`

Obsidian adapter としての永続化層と GUI ビューを置く。

- `InboxStoreManager`: `plugin.loadData()` / `plugin.saveData()` で inbox store を管理する
- `InboxView`: `ItemView` を継承した GUI コンポーネント。Focus / List モードの切り替え、`MarkdownRenderer.render()` による summary 表示、action ボタン、snoozed 自動遷移を担う
- `inboxSettings.ts`: `dismissCooldownDays` などの inbox 固有設定の型と default 値を持つ

plugin 設定の `StoredPluginSettings` に `inboxStore?: unknown` を追加するが、`loadPluginSettings` には inbox store の解釈処理を混ぜない。inbox store は `InboxStoreManager` が独立して管理する。

#### `packages/plugin/src/commands/inbox/`

CLI surface を置く。

- `spec.ts`: 5 command の `CommandSpec` を export する
- `parseCliArgs.ts`: raw `CliData` を command ごとに typed input に変換する
- `registerCliHandler.ts`: 5 command を plugin に登録し、`InboxStoreManager` を通じて CRUD を実行する
- validation: usage error を `UserError` として生成する

#### `main.ts` への追加

`main.ts` の `onload()` に次を追加する。既存の `registerCommands(this)` の呼び出し構造は変えない。

```ts
// view registration
this.registerView(
	INBOX_VIEW_TYPE,
	(leaf) => new InboxView(leaf, inboxStore, this.settings.inboxSettings)
);

// ribbon icon
this.addRibbonIcon("inbox", "Open Inbox", () => {
	this.app.workspace.getRightLeaf(false)?.setViewState({ type: INBOX_VIEW_TYPE, active: true });
});

// command palette
this.addCommand({
	id: "open-inbox-view",
	name: "Open Inbox View",
	callback: () => {
		this.app.workspace
			.getRightLeaf(false)
			?.setViewState({ type: INBOX_VIEW_TYPE, active: true });
	}
});
```

`INBOX_VIEW_TYPE = "excli-inbox-view"` は `InboxView.ts` から export する定数とする。

### Settings integration

`dismissCooldownDays` は plugin 設定として `settingTab.ts` に追加する。UI は数値入力 (1–30 日、default 7)。

`inboxSettings.ts` の型:

```ts
type InboxSettings = {
	dismissCooldownDays: number;
};

const DEFAULT_INBOX_SETTINGS: InboxSettings = {
	dismissCooldownDays: 7
};
```

`SamplePluginSettings` に `inboxSettings: InboxSettings` を追加し、`settings/index.ts` の load/save に組み込む。

### Store migration

`InboxStore.version` フィールドを持つことで将来の schema 変更に対応する。`loadCards()` は `version` が欠落しているか `1` 以外の場合は空の store として扱い、data 喪失より安全な初期化を優先する。

### Performance expectations

inbox store は `plugin.loadData()` で全件をメモリに読み込み、`saveData()` で全件書き戻すシンプルな実装とする。

MVP の使用量想定:

- card 総数は数百件程度
- store の JSON サイズは通常 100KB 未満

これは `loadData()` / `saveData()` が毎回 JSON 全体を読み書きする点で traverse/schema と同様であり、v1 で index やパーシャル更新は不要である。

card 総数が大幅に増えた場合（数千件以上）は将来的に `IndexedDB` への移行や ID インデックスの追加を検討するが、v1 では対応しない。

### Testing strategy

#### Core tests

- `executeCreate`: 新規作成、重複 open/snoozed への集約、dismissed cooldown 内の再生成抑制、cooldown 経過後の再生成
- `executeList`: status 複数指定フィルタ、kind / priority の絞り込み、limit、sort 安定性（priority 降順 → createdAt 昇順）
- `executeUpdate`: 各フィールドの更新、`dismissedAt` が `dismissed` 変更時に設定される、`snoozedUntil` が `open` 変更時に削除される
- `executeDelete`: 存在するカードの削除、存在しないカードで `deleted: false` を返す
- `generateFingerprint`: title のスラグ化、source prefix の付与
- `formatList`: text 形式の 1 行表現、priority ラベルの出力
- `formatShow`: text の key-value 形式、json が `SuggestionCard` をそのまま返す

#### Plugin tests

- `InboxStoreManager`: `loadData()` が返す unknown data から safe parse できること（version 不明な store を空として扱うこと）
- `parseCliArgs`: 各 command の usage error が spec どおり発生すること
- `registerCliHandler`: 5 command が個別に register されること

#### Manual verification

runtime behavior を変える command 追加なので、最終実装時は `pnpm run build` に加えて development vault 上の確認を行う。

想定確認項目:

CLI:

- `excli-inbox:create kind=idea title="テスト提案"` が card を作り ID を返す
- 同じ fingerprint で再度 `create` すると `seenCount` が上がり既存 ID を返す
- `excli-inbox:list` が未処理 card を priority 順に返す
- `excli-inbox:update id=<id> status=done` が status を変更し `updatedAt` を更新する
- `excli-inbox:delete id=<id>` が card を削除し list から消える
- `excli-inbox:show id=<存在しない>` が exit 4 で終わる

GUI:

- ribbon icon クリックで InboxView が right sidebar に開く
- Focus モードで card の summary が markdown として表示され wikilink がクリッカブルになる
- `[Done]` / `[Dismiss]` で status が変わり次 card に自動遷移する
- `[Snooze]` ドロップダウンで snoozedUntil が設定される
- snoozedUntil を過ぎた card が次回 view 開き直し時に `open` に戻る
- List モードのフィルタが Focus モードのカーソル位置に連動する

### InboxView implementation notes

#### View lifecycle

```ts
export class InboxView extends ItemView {
	private store: InboxStoreManager;
	private settings: InboxSettings;
	private cards: SuggestionCard[] = [];
	private focusIndex = 0;
	private mode: "focus" | "list" = "focus";
	private filterStatus: SuggestionCard["status"][] = ["open", "snoozed"];

	getViewType(): string {
		return INBOX_VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Inbox";
	}
	getIcon(): string {
		return "inbox";
	}

	async onOpen(): Promise<void> {
		await this.reload();
		this.registerInterval(window.setInterval(() => void this.wakeupSnoozed(), 60_000));
	}
	async onClose(): Promise<void> {
		this.contentEl.empty();
	}
}
```

#### DOM 構造

Obsidian の `createEl()` / `createDiv()` を使って DOM を構築する。CSS クラス名は `inbox-view-*` prefix で命名し、`styles.css` に追加する。

```
.inbox-view-toolbar     ← モード切替 + ナビゲーション
.inbox-view-card-meta   ← kind badge, priority badge, status indicator
.inbox-view-card-title
.inbox-view-summary     ← MarkdownRenderer の mount 先
.inbox-view-related
.inbox-view-actions     ← Done / Snooze / Dismiss / Open ボタン
.inbox-view-list        ← List モードの行コンテナ
.inbox-view-list-row
```

#### re-render 方針

card のフィールド変更後は `this.contentEl.empty()` で全 DOM を破棄してから `render()` を呼び直す。`MarkdownRenderer` が生成するリンク要素のイベントリスナーは component lifecycle に紐付いているため、`contentEl.empty()` で正しく解放される。

### Rollout note

次の順で導入するのが安全である。

1. `packages/core/src/commands/inbox` の CRUD 純粋関数と formatter を作る（Obsidian 不要）
2. `packages/plugin/src/inbox/InboxStoreManager` を作り、plugin 設定に組み込む
3. `excli-inbox:create` と `excli-inbox:list` を接続して基本 workflow を確認する
4. `excli-inbox:show`, `excli-inbox:update`, `excli-inbox:delete` を追加する
5. `InboxView` を実装し `main.ts` に `registerView()` と ribbon icon を追加する
6. `settingTab.ts` に `dismissCooldownDays` 設定 UI を追加する

Phase 2 以降（外部エージェントや `audit`・`serendipity` からの投入）は `excli-inbox:create` の CLI surface をそのまま使える。`evidence` / `suggestedActions` を含む card を作るには将来の `InboxStoreManager.createCard(card)` を直接呼ぶ内部 API を用意する。

### Open decisions deferred from v1

次は意図的に v1 から外す。

- `evidence` / `suggestedActions` の CLI からの直接指定
- CLI handler 実行後の view への自動リフレッシュ通知（v1 は手動 Refresh ボタン）
- card 総数の上限設定と古い `done` / `dismissed` card の自動削除
- `list` の tsv 出力（automation ユースケースが明確になった段階で追加する）
- `update` での `relatedPaths` の追加・削除
- card の duplicate merge（fingerprint 以外の基準でのマージ）
- Focus モードでの `relatedPaths` 複数 Open のドロップダウン UI（v1 は先頭 1 件のみ Open）
