# Change analysis 設計書

## 概念

### 背景と目的

現行の `excli-apply-patch --dry-run` は、patch の構文妥当性と file-level の変更予定までは返せるが、vault 全体に対する意味的な影響は返せない。特に、リンク切れ、embed 破損、alias 解決不能、backlink 消失による orphan 化候補は、テキスト差分だけでは見落としやすい。

change-analysis はこの不足を埋める shared preflight layer である。独立した `impact` コマンドは作らず、変更系コマンドの `dry-run` に統合する。v1 の user-facing surface は `excli-apply-patch` とし、将来の `refactor` / `workset` は同じ基盤を再利用する。

### 設計方針

**`dry-run` は既定で semantic analysis を実行する。** `excli-apply-patch` で `dry-run` を指定した場合、patch preview に加えて change-analysis を自動実行する。明示的な `analyse` フラグは導入しない。

**無効化は `no-analyse` で行う。** 既存の軽量な preview だけ欲しいケース、速度優先のケース、あるいは semantic analyzer がまだ未対応の mutation surface では `no-analyse` を使う。

**独立コマンドではなく mutation workflow に同居させる。** 「実行できるか」と「vault 的に安全か」を同じ `dry-run` surface で返す。これにより AI agent は apply 前確認を 1 round trip で完了できる。

**分析基盤は metadataCache + delta に寄せる。** 実ファイルは一切書き換えない。"before" state は Obsidian の `metadataCache` をそのまま使う。"after" state はパッチで変更されるファイルの新本文だけを parse して delta を計算する。vault 全体のコンテンツスキャンは行わない。

**既存 foundation を優先再利用する。** graph/link 系は既存の `collectVaultGraphSnapshot.ts`、`resolveEmbedTarget.ts` を土台にする。

**スキャンスコープをパッチ対象に限定する。** v1 から delta アプローチを採用する。全 vault snapshot の再計算は不要であり、将来最適化の対象ではなく設計の出発点とする。

### Goals

- `excli-apply-patch --dry-run` で semantic fallout を既定で返せる
- add / update / move / delete を同じ分析 engine で扱える
- `links` / `embeds` / `orphans` / `aliases` を個別または一括で評価できる
- text / json の deterministic な出力を持てる
- `paths-only` で automation 向けの簡潔出力を返せる
- `refactor` / `workset` が同じ preflight API を再利用できる
- Obsidian API 依存を `packages/plugin` に閉じ込め、比較ロジックは `packages/core` に置ける

### Non-goals

- `plugin-impact` のような独立コマンドを v1 で追加すること
- binary attachment や canvas の semantic analysis
- 修正案の自動生成や auto-fix
- 変更と無関係な vault 全体監査を同時に返すこと
- vault 全体コンテンツスキャンを行うこと（metadataCache + delta で十分）

---

## 仕様設計

### コマンド surface

#### `excli-apply-patch`

```bash
obsidian excli-apply-patch patch=<patch> [dry-run] [no-analyse] [checks=<links,embeds,orphans,aliases>] [paths-only] [format=<text|json>] [allow-create] [verbose]
obsidian excli-apply-patch patch-file=<path> [dry-run] [no-analyse] [checks=<links,embeds,orphans,aliases>] [paths-only] [format=<text|json>] [allow-create] [verbose]
```

`dry-run` を指定した場合は、patch plan の preview に加えて change-analysis を既定で実行する。`no-analyse` を指定した場合のみ、既存と同じ preview-only mode に落とす。

#### 将来の `refactor`

```bash
obsidian plugin-refactor extract path=notes/big.md heading="機械学習" to=notes/ml.md dry-run
obsidian plugin-refactor extract path=notes/big.md heading="機械学習" to=notes/ml.md dry-run no-analyse
```

`refactor` 側でも同じ原則を採用する。すなわち、`dry-run` は既定で analysis on、無効化は `no-analyse` とする。

### Option semantics

| option         | 型                        | 説明                                                                            |
| -------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `dry-run`      | boolean                   | 実ファイルを書き換えず、仮適用結果を返す。既定で change-analysis を含む         |
| `no-analyse`   | boolean                   | `dry-run` 中の semantic analysis を無効化し、preview-only mode にする           |
| `checks`       | comma-separated enum list | 実行する分析カテゴリを絞る。省略時は全カテゴリ                                  |
| `paths-only`   | boolean                   | finding の詳細を省き、影響パス集合を中心に返す                                  |
| `format`       | `text \| json`            | analysis を含む dry-run 出力形式。省略時は `text`                               |
| `allow-create` | boolean                   | 実適用時の Add File を許可する。意味は現行どおり                                |
| `verbose`      | boolean                   | patch plan の per-file detail を返す。analysis の detail も text 出力で展開する |

### デフォルト動作

| 条件                 | 動作                                                      |
| -------------------- | --------------------------------------------------------- |
| `dry-run` なし       | 現行どおり patch を実適用する。change-analysis は走らない |
| `dry-run`            | patch plan preview + change-analysis を返す               |
| `dry-run no-analyse` | patch plan preview のみ返す                               |

### Check categories

| check     | 検出内容                                      | 既定 severity |
| --------- | --------------------------------------------- | ------------- |
| `links`   | 新規 unresolved link、既存 link 解決先の消失  | `high`        |
| `embeds`  | broken embed、heading / block 参照切れ        | `high`        |
| `orphans` | backlink 消失により orphan 条件を満たすノート | `medium`      |
| `aliases` | alias 衝突、alias からの解決不能化            | `high`        |

`schema` は v1 対象外とする。`apply-patch` は本文 patch のみを扱い、frontmatter を直接書き換える操作がないため、coverage 変動の検出意義が薄い。将来 frontmatter 書き換えを行う `refactor` コマンドで改めて検討する。

severity は finding 単位でも持ち、全体 risk は最も高い severity を基本に集約する。

### 入力検証

| 条件                                                     | エラー種別  |
| -------------------------------------------------------- | ----------- |
| `no-analyse` を `dry-run` なしで指定                     | usage error |
| `checks` を `dry-run` なしで指定                         | usage error |
| `paths-only` を `dry-run` なしで指定                     | usage error |
| `format` を `dry-run` なしで指定                         | usage error |
| `checks` を `no-analyse` と同時指定                      | usage error |
| `paths-only` を `no-analyse` と同時指定                  | usage error |
| `checks` に未知のカテゴリを含む                          | usage error |
| `patch` と `patch-file` の同時指定、またはいずれも未指定 | usage error |

`allow-create` と `verbose` の既存検証は維持する。

### 出力仕様

#### `dry-run` text

```text
Dry run completed. 2 file changes planned.
Updated: notes/spec.md
Moved: notes/api.md -> notes/api-v2.md

Change analysis: high risk
Checks: links, embeds, orphans, aliases

high
  - 2 unresolved links would be introduced
  - 1 embed would stop resolving

medium
  - 1 note would become orphaned: notes/legacy-design.md
```

text 出力では patch plan を先に、analysis を後に出す。順序は次の通りで固定する。

1. patch plan headline
2. patch plan details
3. analysis headline
4. severity ごとの summary
5. `verbose` 時のみ per-finding detail

#### `dry-run` JSON

```ts
type ApplyPatchDryRunResult = ApplyPatchDryRunAnalysisResult | ApplyPatchDryRunNoAnalyseResult;

type ApplyPatchDryRunPlan = {
	changedFileCount: number;
	files: {
		path: string;
		nextPath?: string;
		operation: "add" | "delete" | "update" | "move";
		status: "planned" | "failed" | "skipped";
		message?: string;
	}[];
};

type ApplyPatchDryRunAnalysisResult = {
	command: "excli-apply-patch";
	dryRun: true;
	plan: ApplyPatchDryRunPlan;
	analysis: {
		enabled: true;
		checks: ("links" | "embeds" | "orphans" | "aliases")[];
		risk: "none" | "low" | "medium" | "high";
		summary: {
			unresolvedLinks: number;
			brokenEmbeds: number;
			orphanCandidates: number;
			aliasConflicts: number;
		};
		affectedPaths: string[];
		findings: ChangeAnalysisFinding[];
	};
};

type ApplyPatchDryRunNoAnalyseResult = {
	command: "excli-apply-patch";
	dryRun: true;
	plan: ApplyPatchDryRunPlan;
	analysis: { enabled: false };
};
```

`paths-only` 指定時も JSON shape は維持し、`findings` は空配列、`affectedPaths` を主要出力とする。consumer 側が shape 分岐せずに扱えることを優先する。

#### `dry-run no-analyse`

`format` 省略時は現行の patch preview と同じ text formatter を使う。

`format=json` を指定した場合は `ApplyPatchDryRunNoAnalyseResult` を返す。

```json
{
	"command": "excli-apply-patch",
	"dryRun": true,
	"plan": {
		"changedFileCount": 2,
		"files": [
			{ "path": "notes/spec.md", "operation": "update", "status": "planned" },
			{
				"path": "notes/api.md",
				"nextPath": "notes/api-v2.md",
				"operation": "move",
				"status": "planned"
			}
		]
	},
	"analysis": { "enabled": false }
}
```

`checks` / `paths-only` は `no-analyse` と同時指定できない（usage error）。`format` と `verbose` は同時指定可能。

### Finding model

```ts
type ChangeAnalysisFinding =
	| {
			check: "links";
			severity: "high";
			sourcePath: string;
			targetPath: string | null;
			linkText: string;
			line: number | null;
			message: string;
	  }
	| {
			check: "embeds";
			severity: "high";
			sourcePath: string;
			targetPath: string | null;
			embedText: string;
			line: number | null;
			message: string;
	  }
	| {
			check: "orphans";
			severity: "medium";
			path: string;
			backlinksBefore: number;
			backlinksAfter: number;
			message: string;
	  }
	| {
			check: "aliases";
			severity: "high";
			alias: string;
			conflictingPaths: string[];
			message: string;
	  };
```

各 finding は text / json のどちらでも同じ source data を使い、formatter だけを分ける。

---

## 詳細設計

### 実行パイプライン

change-analysis を含む `apply-patch dry-run` は 5 段階で処理する。

1. CLI 入力を parse し、`dry-run` / `no-analyse` / `checks` / `format` の整合性を検証する
2. patch text を読み込み、既存の `parseApplyPatch` / `planApplyPatchChanges` で file operation plan を構築する
3. plugin 側で `ChangeAnalysisContext` を構築する（metadataCache + 変更ファイルの新本文 parse）
4. core 側で指定された check 群を context に対して実行し、finding と risk summary を生成する
5. patch plan と analysis result を結合して formatter に渡す

`no-analyse` の場合は step 3 の context 構築を省略し、step 2 の結果をそのまま既存 formatter に流す。

### 分析コンテキストモデル

`ChangeAnalysisContext` は plugin 層が構築し、core 層の analyzer に渡す唯一の入力となる。vault 全体をスキャンするのではなく、パッチ対象ファイルと Obsidian の metadataCache から必要な情報だけを抽出する。

```ts
type ChangeAnalysisContext = {
	// パッチで変更される各ファイルの before/after スナップショット
	changedEntries: ChangedEntry[];
	// パッチ適用後の vault 全ファイルパス集合（link 解決先の存在確認に使う）
	vaultPathsAfter: Set<string>;
	// orphan 候補：パッチにより backlink を失う可能性のあるファイルの before 時点の backlink 数
	// key = 候補ファイルパス、value = before 時点の総 backlink 数（metadataCache から取得）
	orphanCandidateCounts: Map<string, number>;
	// delete / move 対象ファイルへの before 時点の backlink 元パス一覧
	// key = 削除・移動される old path、value = そのファイルにリンクしているファイルパス群
	inboundLinksBefore: Map<string, string[]>;
	// alias → 解決先パスの一覧（before 時点、metadataCache から取得）
	// "aliases" check が有効かつ add / delete 操作がある場合のみ構築する
	aliasIndexBefore: Map<string, string[]>;
};

type ChangedEntry = {
	operation: "add" | "update" | "move" | "delete";
	before: NoteSnapshot | null; // add の場合は null
	after: NoteSnapshot | null; // delete の場合は null
};

type NoteSnapshot = {
	path: string;
	frontmatter: Record<string, unknown> | null;
	aliases: string[];
	outgoingLinks: ResolvedReference[];
	outgoingEmbeds: ResolvedReference[];
};

type ResolvedReference = {
	linkText: string;
	targetPath: string | null; // null = 未解決
	fragment: string | null;
	line: number | null;
};
```

`NoteSnapshot` の "before" は `metadataCache.getFileCache()` / `resolvedLinks` / `unresolvedLinks` から構築する。"after" はパッチの新本文を parse して構築する。backlink 情報は `NoteSnapshot` には持たせず、cross-file の集計が必要な場合は `orphanCandidateCounts` / `inboundLinksBefore` に切り出す。

### check ごとの情報要件

各 check が `ChangeAnalysisContext` のどのフィールドを使うかを示す。

| check                | 使用フィールド                            | 説明                                            |
| -------------------- | ----------------------------------------- | ----------------------------------------------- |
| `links`（outgoing）  | `changedEntries`, `vaultPathsAfter`       | 変更ファイルの新 outgoing link が解決できるか   |
| `links`（inbound）   | `inboundLinksBefore`, `vaultPathsAfter`   | delete/move により他ファイルの link が切れるか  |
| `embeds`（outgoing） | `changedEntries`, `vaultPathsAfter`       | 変更ファイルの新 embed が解決できるか           |
| `embeds`（inbound）  | `inboundLinksBefore`, `vaultPathsAfter`   | delete/move により他ファイルの embed が切れるか |
| `orphans`            | `changedEntries`, `orphanCandidateCounts` | backlink を失ったファイルが orphan になるか     |
| `aliases`            | `changedEntries`, `aliasIndexBefore`      | alias 解決不能化・衝突が発生するか              |

### Package 構成

#### `packages/core`

```
packages/core/src/analysis/change/
  types.ts           ← ChangeAnalysisContext, NoteSnapshot, ChangedEntry, ResolvedReference, ChangeAnalysisFinding
  compareLinks.ts
  compareEmbeds.ts
  compareOrphans.ts
  compareAliases.ts
  summarizeRisk.ts
  formatText.ts
  formatJson.ts
  index.ts
```

責務は以下の通り。

- `ChangeAnalysisContext` を受け取り、check ごとの比較を実行する
- finding と risk の集約
- text / json formatter

`packages/core/src/commands/apply-patch` には既存の patch parse / plan ロジックがあるため、change-analysis はそれを呼ぶ側として実装する。patch 文法自体は複製しない。

#### `packages/plugin`

```
packages/plugin/src/analysis/
  buildChangeAnalysisContext.ts   ← ChangeAnalysisContext を構築する唯一のエントリポイント
  index.ts
```

責務は以下の通り。

- `app.metadataCache` から変更ファイルの "before" スナップショットを取得する
- patch plan の新本文を parse して "after" スナップショットを構築する
- `vaultPathsAfter`（vault 全ファイルパスから削除を引き、追加を足す）を構築する
- `orphanCandidateCounts`（backlink を失う候補の backlink 数を metadataCache から取得）を構築する
- `inboundLinksBefore`（削除・移動対象ファイルへの backlink 元を metadataCache から取得）を構築する
- `aliasIndexBefore`（aliases check が必要かつ add/delete 操作がある場合のみ metadataCache から構築）を構築する

既存の `collectVaultGraphSnapshot.ts`、`resolveEmbedTarget.ts` は再利用し、新規実装は adapter に限定する。

#### `packages/plugin/src/commands/apply-patch`

既存ファイルを以下のように拡張する。

- `spec.ts`: `no-analyse` / `checks` / `paths-only` / `format` を追記
- `parseCliArgs.ts`: 新規 option parse と usage error 追加
- `types.ts`: dry-run analysis option を保持
- `registerCliHandler.ts`: `dry-run` かつ `!noAnalyse` のとき snapshot builder と analyzer を呼ぶ

### `registerCliHandler` の分岐

```ts
if (!input.dryRun) {
	// 現行どおり実適用
}

if (input.noAnalyse) {
	// 現行 dry-run formatter
}

// buildChangeAnalysisContext で context を構築し、analyzer を呼ぶ
```

これにより、非 `dry-run` と `dry-run no-analyse` の既存 UX を壊さずに拡張できる。

### 分析ロジック

#### `links`

**outgoing（変更ファイルから外への link）:**

- `changedEntries` の `after.outgoingLinks` を走査し、`targetPath` が `vaultPathsAfter` に存在しないものを unresolved として検出する
- `before.outgoingLinks` で解決できていた link が `after.outgoingLinks` で未解決になったケースも検出する
- sort 順は `sourcePath`, `line`, `linkText`

**inbound（delete/move により他ファイルの link が切れる）:**

- `inboundLinksBefore` から、削除・移動される path へのリンク元ファイルを取得する
- `vaultPathsAfter` に old path が存在しない（= 削除または移動で old path が消えた）場合、そのリンク元ファイル群を finding として報告する
- move の場合は old path が消え new path が追加されるため、old path へのリンクは broken になる

#### `embeds`

**outgoing（変更ファイルから外への embed）:**

- `![[note]]`, `![[note#heading]]`, `![[note#^block]]` を対象にする
- `after.outgoingEmbeds` を走査し、`targetPath` が `vaultPathsAfter` に存在しないものを broken として検出する
- fragment（heading / block）を持つ embed は、target ファイルの内容を読んで fragment の存在を確認する（target ファイル1件のみ read）

**inbound（delete/move により他ファイルの embed が切れる）:**

- `links`（inbound）と同じロジック。`inboundLinksBefore` を使う

#### `orphans`

- 候補集合の絞り込み：`changedEntries` の `before.outgoingLinks` にあった link 先のうち、`after.outgoingLinks` に含まれなくなったパスを候補とする（変更・削除ファイルが向けていた link の消失先）
- 各候補 C について：`orphanCandidateCounts[C]`（before の総 backlink 数）から、パッチにより失われた分（変更ファイルが before で C へ張っていた link 数）を引く
- 結果が 0 になった場合のみ orphan として報告する
- `orphanCandidateCounts` に存在しない path（= before 時点で backlink が 0 だった）は候補から除外する（既存 orphan は対象外）

#### `aliases`

apply-patch は本文 patch のみを扱うため、update / move 操作では frontmatter が変わらず alias も変わらない。有意な検出対象は add と delete に限られる。

**add（新ファイルに alias がある場合）:**

- `after.aliases` の各エントリを `aliasIndexBefore` と突き合わせる
- 既存の別ファイルが同じ alias を持つ場合、conflict として報告する
- `aliasIndexBefore` が空（aliases check が無効または add/delete 操作なし）の場合は skip する

**delete（ファイルの alias が消滅する場合）:**

- `before.aliases` の各エントリについて、`aliasIndexBefore` でその alias が当該ファイルのみで定義されていた場合を unresolvable として報告する（他ファイルが同じ alias を持っていれば問題なし）

### リスク集約

全体 risk は最大 severity を採用し、summary count は check ごとに集計する。

| 条件                            | risk     |
| ------------------------------- | -------- |
| finding なし                    | `none`   |
| `high` finding を 1 件以上含む  | `high`   |
| `high` はないが `medium` がある | `medium` |

v1 の check には `low` severity が存在しないため、`low` risk は発生しない。将来 `schema` check を追加する際に改定する。weighted score は導入しない。判定規則を明示し、出力の解釈を安定させる。

### Formatter 方針

text formatter は人間と AI agent の双方が読みやすい summary-first 構成にする。JSON formatter は automation 向けに、text と同じ事実を欠落なく返す。

- path の並びは常に昇順
- severity は `high` → `medium`
- `checks` の並びは `links`, `embeds`, `orphans`, `aliases`

### テスト観点

- `dry-run` が既定で analysis on になること
- `dry-run no-analyse` が現行 preview-only と同じ結果になること
- `dry-run no-analyse format=json` が `analysis: { enabled: false }` を含む JSON を返すこと
- `checks` の subset 実行で不要な finding が出ないこと
- move / delete / add / update の各操作で before / after 差分が正しく出ること
- `format=json` と text が同じ finding 集合を表現していること

### 将来拡張

- `refactor` / `workset` は、mutation plan から `ChangeAnalysisContext` を構築して同じ analyzer に渡すだけで統合できる。`buildChangeAnalysisContext` の入力を "patch plan" から抽象的な "mutation plan" に一般化することで対応する
- `audit` との formatter 共通化は可能だが、v1 では change-analysis 固有 formatter を優先する
- `schema` check は frontmatter 書き換えを扱う `refactor` コマンドと合わせて将来追加する。その際、`ChangeAnalysisContext` に `aliasIndexBefore` と同様のパターンで `propertyStatsBefore` を追加する
