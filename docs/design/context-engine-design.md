# Context engine 設計書

## 概要

### 背景と目的

AI エージェントが Obsidian vault の複数ノートを読む場合、現状では `excli-read` を繰り返し呼ぶ必要がある。これはラウンドトリップが嵩み、関連ノートを丸ごとコンテキストに乗せることが難しい。

context-engine はその解消を目的とした共通基盤と 1 つの user-facing command から構成される。

- `excli-read:bulk` — 複数ノートを 1 round trip で取得する。embed 展開は `resolve-embeds` オプションで有効化できる

graph-aware な関連ノート収集は `excli-traverse:reach` と `excli-read:bulk` の組み合わせで実現する。将来の `excli-narrative` はこの基盤を再利用し、event extraction と timeline ordering だけに集中できる。

### 設計方針

**command は 1 つに絞る。** user-facing surface は `excli-read:bulk` のみとし、note loading・embed resolution・token budget 制御・bundle formatting の実装を共通 pipeline として持つ。

**embed 展開はフラグで制御する。** 独立 command として surface させず、`resolve-embeds` / `embed-depth` / `annotate-embeds` フラグで `read:bulk` の動作を切り替える。

**graph 連携は compose で行う。** seed-based な関連ノート収集は `excli-traverse:reach` でパスリストを取得し、その結果を `excli-read:bulk paths=...` に渡すことで実現する。`read:bulk` 自体はグラフ traversal を持たない。

**`traverse` を shipped foundation として再利用する。** graph 操作は既存の `collectVaultGraphSnapshot` / `resolveGraphOperand` / traverse core API を直接利用する。

### Goals

- markdown ノート群を deterministic な順序で一括取得できる
- ノート本文と frontmatter を token budget 付きで bundle 化できる
- `![[note]]` / `![[note#heading]]` / `![[note#^block-id]]` を再帰展開できる
- embed の循環参照・未解決参照を安定した形式で表現できる
- shared foundation が将来の `narrative` に再利用できる API を持つ
- `packages/plugin/src/main.ts` に registration 以上の責務を持ち込まない
- command spec は他 command と同様に `spec.ts` を source of truth とする
- Obsidian API 依存を `packages/plugin` に閉じ込め、共通ロジックを `packages/core` で test できる

### Non-goals

- `excli-embed-resolve` として独立した embed 展開コマンドを作ること
- `excli-context` として graph traversal と content fetch を 1 コマンドに統合すること
- semantic ranking・vector search を v1 に入れること
- binary attachment の展開・OCR
- `narrative` の event extraction / branch reconstruction を今回の concrete delivery に含めること
- persistent cache や on-disk index file の導入
- 既存の `excli-read` を置き換えること

---

## 仕様設計

### コマンド一覧

#### `excli-read:bulk`

```
obsidian excli-read:bulk path=<path> [max-files=<n>] [max-char=<n>] [include-frontmatter] [resolve-embeds] [embed-depth=<n>] [annotate-embeds] [format=<markdown|json|tsv>]
obsidian excli-read:bulk paths=<path[,path...]|json-array> [max-files=<n>] [max-char=<n>] [include-frontmatter] [resolve-embeds] [embed-depth=<n>] [annotate-embeds] [format=<markdown|json|tsv>]
obsidian excli-read:bulk [folder=<path>] [tag=<tag>] [sort=<path|mtime|size>] [max-files=<n>] [max-char=<n>] [include-frontmatter] [resolve-embeds] [embed-depth=<n>] [annotate-embeds] [format=<markdown|json|tsv>]
```

対象が決まっている複数ノートを 1 round trip で返す content fetch primitive。ranking や graph traversal を持たない。

`path` 系と `folder` / `tag` 系は排他。`folder` と `tag` を同時指定した場合は AND 条件。

---

### Option semantics

#### Note operand

| option  | 型                            | 説明                                                           |
| ------- | ----------------------------- | -------------------------------------------------------------- |
| `path`  | vault-relative markdown path  | 単一ノート指定。`.md` を省略しない canonical path を基本とする |
| `paths` | comma-separated or JSON array | 複数ノートの明示指定。実 CLI ではこちらを基本にする            |

実際の Obsidian CLI では repeated `path=` が潰れることがあるため、複数 path は `paths=` を基本にし、shell-safe なケースでは JSON array も受ける。

#### Scope selection

- 対象は `.md` file のみ
- `vault/.obsidian/` 配下は常に除外
- `folder` は vault-relative folder prefix
- `tag` は leading `#` を除去して比較
- `folder` と `tag` の同時指定は AND 条件
- 複数 `folder` / 複数 `tag` の OR 条件は v1 未対応

#### Sort（`folder` / `tag` scope のみ有効）

| 値      | 順序                                 |
| ------- | ------------------------------------ |
| `path`  | path 昇順                            |
| `mtime` | `mtimeMs` 降順、同値時は path 昇順   |
| `size`  | `sizeBytes` 降順、同値時は path 昇順 |

explicit `path` 指定時は caller order を保持し、重複 path は最初の出現だけ残す。

#### Char budget

- `max-char=<n>` は返却する本文・frontmatter・annotation comment を含む文字数上限
- budget 超過時の打ち切りは deterministic に行う

打ち切りポリシー:

- note をまるごと入れられるならそのまま採用する
- 1 件目の note が budget を超える場合のみ、その note を残して本文を先頭から切り詰める
- 2 件目以降で残量を超える note は追加せず打ち切る

---

### Input validation

#### `read:bulk`

| 条件                                                             | エラー種別      |
| ---------------------------------------------------------------- | --------------- |
| `path` が 1 件以上あるのに `folder` / `tag` を指定               | usage error     |
| `path`, `folder`, `tag` がいずれもない                           | usage error     |
| explicit `path` 指定時に `sort` を指定                           | usage error     |
| `resolve-embeds` なしで `embed-depth` / `annotate-embeds` を指定 | usage error     |
| `max-files` が正の整数でない                                     | usage error     |
| `max-char` が正の整数でない                                      | usage error     |
| `embed-depth` が 0 未満                                          | usage error     |
| explicit mode で `path` が vault に存在しない                    | command failure |

---

### Output format

#### `read:bulk` — markdown

````markdown
<!-- excli-read:bulk truncated=false -->

## papers/foo.md

```yaml
status: reading
```

# Foo

...

## papers/bar.md

...
````

- note 順は selection 後の順序を保持
- `include-frontmatter` 指定時のみ YAML block を挿入
- truncated note には section 見出し行に `truncated` を付ける
- `resolve-embeds` 指定時は note ごとに flatten 済み本文を使う
- `annotate-embeds` 指定時のみ embedded source comment を挿入する

#### `read:bulk` — JSON

```ts
type ReadBulkResult = {
	truncated: boolean;
	notes: BundleEntry[];
};
```

#### `read:bulk` — TSV

```tsv
path	relation	truncated
papers/foo.md	explicit	false
papers/bar.md	explicit	false
```

TSV は automation 向け summary。本文は含めない。

---

## 詳細設計

### 共通 pipeline

context-engine の共通 pipeline は 4 段階:

```
1. scope 解決     → candidate note path 群を決める
2. note loading   → plugin 側で metadata と raw markdown をロードする
3. embed 展開     → (optional) display-equivalent text を生成する
4. budget 適用    → char budget と max-files で deterministic に打ち切る
5. formatting     → markdown / json / tsv へ整形する
```

stage 1–2 は plugin 寄りの責務、stage 3–5 は core 寄りの責務とする。

---

### Package 構成

#### `packages/core` — Obsidian API に依存しない共通ロジック

```
packages/core/src/context-engine/
  types.ts               # 共有型定義
  tokenBudget.ts         # token 推定と truncation policy
  sortNotes.ts           # note 順序の決定
  parseEmbedRefs.ts      # ![[...]] ref の parse
  extractMarkdownSection.ts  # heading / block 単位の section 抽出
  resolveEmbeds.ts       # recursive embed 展開
  formatMarkdownBundle.ts    # markdown bundle の組み立て
  index.ts
```

Obsidian API は import しない。I/O は callback interface で受け取るか、plugin 側で前処理済みデータを受け取る。

#### `packages/plugin` — Obsidian API を使う vault 操作

```
packages/plugin/src/context-engine/
  buildVaultNoteCatalog.ts    # vault 上の markdown note catalog を構築する
  loadVaultNotes.ts           # MetadataCache / Vault から本文・frontmatter・tags・mtime を読む
  resolveEmbedTarget.ts       # MetadataCache.getFirstLinkpathDest() で embed target を解決する
  index.ts
```

#### Command modules

```
packages/core/src/commands/read/
packages/plugin/src/commands/read/      # spec.ts を含む
```

`read` directory は v1 では `bulk` mode のみ持つが、CLI surface は `excli-read:bulk` とする。

---

### 型定義

```ts
type LoadedContextNote = {
	path: string;
	name: string;
	folder: string;
	tags: string[];
	frontmatter: Record<string, unknown> | null;
	rawContent: string;
	mtimeMs: number;
	sizeBytes: number;
};

type BundleEntry = {
	path: string;
	name: string;
	relation: "explicit";
	frontmatter: Record<string, unknown> | null;
	content: string;
	truncated: boolean;
	resolvedEmbeds: ResolvedEmbedSummary[];
};

type ResolvedEmbedSummary = {
	ref: string;
	resolvedPath: string | null;
	section: {
		kind: "whole-note" | "heading" | "block";
		value: string | null;
	};
	status: "resolved" | "missing" | "circular" | "depth-limited";
};
```

---

### `read:bulk` — 実装詳細

#### Selection model

**explicit path mode**

- caller order を保持する
- 重複 path は最初の出現だけ残す
- missing path は command failure

**scoped mode**

- `buildVaultNoteCatalog()` が返す note 集合から `folder` / `tag` で絞り込む
- `sort` に従って並べる
- `max-files` は budget 適用前の上限制御として先に効かせる

#### Read model

- 本文ロードは plugin 側でまとめて実行する
- `include-frontmatter` がなくても frontmatter は internal metadata として保持してよい
- `resolve-embeds` 指定時のみ shared embed resolver を通す
- budget は embed 展開後の本文に対して適用する

---

### embed resolver — 実装詳細

`resolve-embeds` フラグが有効な場合に適用される。

#### Resolver semantics

- 展開対象は `![[...]]` のみ（通常の `[[...]]` link は展開しない）
- `![[note]]` — ノート全体を挿入する
- `![[note#heading]]` — 該当 heading section を挿入する
- `![[note#^block-id]]` — block を挿入する
- `embed-depth` default は `3`
- `embed-depth=0` は root note 本文をそのまま返し、埋め込みは展開しない

#### Edge case handling

| 状態                                | status          | markdown 出力                     |
| ----------------------------------- | --------------- | --------------------------------- |
| 同一 resolution stack に既出の path | `circular`      | `<!-- circular-embed: <path> -->` |
| target が解決できない               | `missing`       | `<!-- missing-embed: <path> -->`  |
| depth 上限で止まった                | `depth-limited` | （展開せずにそのまま残す）        |

循環・未解決・depth 制限は `BundleEntry.resolvedEmbeds` の `status` にも記録する。

---

### Registration

`main.ts` は次の 1 関数を `registerCommands()` に追加するだけに留める:

```ts
registerReadCommand(plugin);
```

---

## 検証計画

### Core tests

- token estimate と truncation policy
- markdown bundle formatter
- embed ref parser（`![[...]]` の各形式）
- heading / block section 抽出
- recursive embed 展開
- circular / missing / depth-limited の各 edge case

### Plugin tests

- `read:bulk` の selector validation（`path` と `folder`/`tag` の排他）
- `paths=` と JSON array fallback
- folder / tag フィルタリング

### Runtime validation

vault-facing behavior は unit test だけでは不十分。実装時に少なくとも次を行う:

```sh
pnpm run test
pnpm run build
./bin/obsidian-dev obsidian excli-read:bulk paths=...
./bin/obsidian-dev obsidian excli-read:bulk folder=... resolve-embeds
```

---

## Rollout 順序

| フェーズ | 内容                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 1        | `traverse` foundation の既知 issue を閉じ、`read:bulk` が依存できる状態にする |
| 2        | `read:bulk` basic を実装し、multi-note fetch と token budget を成立させる     |
| 3        | `resolve-embeds` オプションを実装し、display-equivalent read を成立させる     |

この順序により、context-engine を 1 つの巨大機能としてではなく、価値の出る最小単位へ分解して delivery する。
