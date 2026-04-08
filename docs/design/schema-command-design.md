# Schema command design

## 目的

Obsidian CLI 拡張として `schema` command を追加し、vault 全体または限定スコープの frontmatter / properties を集計して、AI と人間の両方が扱える決定論的なスキーマ要約を返せるようにする。

この command は単独でも有用だが、[`analysis-foundation`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/feature-proposals/integrated/analysis-foundation.md) の最初の実装対象として設計する。`audit` や `impact` が同じ snapshot と schema 推論結果を再利用できることを前提に、command surface と共有基盤を分けて定義する。

## Overview

`schema` command は markdown note 群を走査し、各 note の frontmatter、Obsidian が把握している property type、タグ情報を 1 つの snapshot にまとめる。その上で次の 3 モードを提供する。

- infer: スコープ内で暗黙的に使われている property schema を要約する既定モード
- missing: 指定 property を持たない note を列挙する運用モード
- validate: 1 つ以上の note の frontmatter をスコープ内 schema に照合する検査モード

狙いは次の 4 点。

- vault-wide な frontmatter 慣習を AI が読むための判断材料を作る
- `audit` の schema check と `impact` の schema regression 判定に流用できる core API を先に固める
- `MetadataCache` が持つ property type を活かしつつ、coverage や enum 候補のような vault 固有の統計を追加する
- `main.ts` には registration だけを残し、snapshot 取得と集計ロジックを command/module 単位に閉じ込める

## Goals

- vault 全体または folder / tag で絞った note 集合から schema を推論できる
- `infer` で `group-by` を使い、tag / folder / 特定 property 値ごとの差分 schema を比較できる
- property ごとの coverage、出現 note 数、型、enum 候補、format hint、warning を返せる
- `excli-schema:missing key=<key>` で欠落 note を script-friendly に列挙できる
- `excli-schema:validate path=<path>...` で 1 つ以上の note の frontmatter を schema に照合できる
- Obsidian の property type と、AI が扱いやすい値の shape を両方返せる
- 推論・欠落判定・バリデーションを `packages/core` の純粋関数として test できる
- 将来の `audit` / `impact` が再利用できる snapshot と schema analyzer を用意する

## Non-goals

- frontmatter の自動修正
- inline field や note body の自然言語から property を推論すること
- vault 間比較や時系列差分
- user-defined schema file を source of truth にすること
- semantic duplicate 判定の完全自動化
- 複数 property を同時に指定する missing query
- `validate` の target note 集合を glob / saved search / stdin から解決すること
- 自動クラスタリングで schema segment を発見すること

## Command shape

機能全体の directory 名は `schema` としつつ、CLI handler は Obsidian CLI の `:` 区切り規約に合わせて mode ごとに別 command として登録する。user-facing surface は option の組み合わせで mode を暗黙決定せず、command 名で明示する。

```text
obsidian excli-schema:infer [folder=<path>] [tag=<tag>] [group-by=<folder|tag|property:<key>>] [min-coverage=<0-100>] [format=<text|json|tsv>]
obsidian excli-schema:missing key=<key> [folder=<path>] [tag=<tag>] [format=<text|json|tsv>]
obsidian excli-schema:validate path=<path> [path=<path> ...] [folder=<path>] [tag=<tag>] [missing-threshold=<0-100>] [fail-on=<low|high|none>] [format=<text|json>]
```

内部 module 名や command ID は `schema:infer`, `schema:missing`, `schema:validate` としてよい。公開 CLI 名は `excli-schema:infer`, `excli-schema:missing`, `excli-schema:validate` とする。

### Commands

- infer
  - handler 名: `excli-schema:infer`
  - 返り値: schema summary、または group-by を伴う grouped schema summary
- missing
  - handler 名: `excli-schema:missing`
  - 返り値: 指定 key を持たない note 一覧
- validate
  - handler 名: `excli-schema:validate`
  - 返り値: 1 つ以上の note と schema の照合結果

### Option semantics

- `folder=<path>`
  - vault-relative folder prefix
  - `excli-schema:infer` / `excli-schema:missing` では対象 note 集合を絞る
  - `excli-schema:validate` では参照 schema を作る母集団を絞る
  - target note 自体はこの folder 外でもよい
- `tag=<tag>`
  - `#` の有無を問わず受け取り、内部では leading `#` を除去して正規化する
  - `excli-schema:infer` / `excli-schema:missing` では対象 note 集合を絞る
  - `excli-schema:validate` では参照 schema を作る母集団を tag で絞る
  - note selection は `MetadataCache` から得られる note tag 集合に対して行う
- `key=<key>`
  - `excli-schema:missing` 専用
  - 指定 key を持たない note を列挙する
  - key 比較は frontmatter key の大文字小文字を保持した完全一致ではなく、Obsidian property key と同じ case-sensitive key をそのまま用いる
- `path=<path>`
  - `excli-schema:validate` 専用
  - validate 対象の markdown note
  - 1 回以上指定できる
  - 重複 path は de-duplicate し、出力時は path 昇順に並べる
  - vault root 基準の vault-relative path とする
- `group-by=<folder|tag|property:<key>>`
  - `excli-schema:infer` 専用
  - base scope を group ごとに分割して、group 単位の schema summary を返す
  - `folder`
    - note の親 folder ごとに group を作る
    - folder 値は vault-relative path をそのまま使い、vault root 直下は `""` とする
  - `tag`
    - 正規化済み tag ごとに group を作る
    - 1 note が複数 tag を持つ場合、複数 group に重複して入る
  - `property:<key>`
    - frontmatter 上の指定 key の scalar 値ごとに group を作る
    - scalar は `string`, `number`, `boolean` のみとし、array / object / null は group 化しない
    - `type` ごとの差分 schema を見たい場合は `group-by=property:type` を使う
- `min-coverage=<0-100>`
  - `excli-schema:infer` 専用
  - percentage integer
  - infer では表示対象 property を絞る
  - default は `10`
- `missing-threshold=<0-100>`
  - `excli-schema:validate` 専用
  - percentage integer
  - `missing` issue を出す対象 property の coverage 下限
  - default は `60`
- `fail-on=<low|high|none>`
  - `excli-schema:validate` 専用
  - process exit code を 1 にする severity 下限
  - `low` は issue が 1 件でもあれば fail、`none` は常に exit 0
  - `high` は強い schema 違反だけで fail する
  - default は `high`
- `format=<text|json|tsv>`
  - default は `text`
  - infer: `text`, `json`, `tsv`
  - missing: `text`, `json`, `tsv`
  - validate: `text`, `json`
  - `validate format=tsv` は validation error

### Validation of command inputs

- `excli-schema` 単体は登録しない
- unknown `excli-schema:*` command 名は registration されない
- `excli-schema:missing` なのに `key` がない場合は usage error
- `excli-schema:validate` なのに `path` が 1 つもない場合は usage error
- `key` は `excli-schema:missing` 以外では usage error
- `path`, `missing-threshold`, `fail-on` は `excli-schema:validate` 以外では usage error
- `min-coverage` と `group-by` は `excli-schema:infer` 以外では usage error
- `min-coverage` が 0 未満または 100 超過なら error
- `missing-threshold` が 0 未満または 100 超過なら error
- `fail-on` は `low`, `high`, `none` 以外では error
- `group-by` は `folder`, `tag`, `property:<key>` 以外では error

## Scope selection model

schema の母集団は「markdown file かつ vault config 配下ではない note」とする。初版では次を前提にする。

- 対象拡張子は `.md` のみ
- `vault/.obsidian/` 配下は常に除外する
- frontmatter が存在しない note も母数には含める
- `folder` は prefix match とし、`notes` と `notes/` は同じ folder に正規化する
- `tag` filter は OR ではなく単一 tag 指定のみを v1 とする
- `folder` と `tag` を同時指定した場合は AND 条件で絞る

`group-by` は base scope の選定が終わったあとに適用する。つまり `folder` / `tag` は「どの note を見るか」を決め、`group-by` は「その note 群をどう分けて比較するか」を決める。

validate では 2 つの集合を区別する。引数名は `infer` / `missing` と揃えて `folder` / `tag` を使うが、この command では常に schema scope を指す。

- schema scope: `folder` / `tag` filter 後の note 集合から、target path と一致した note を除いた集合
- target note: `path` で指定された 1 つ以上の note

この分離により、「project フォルダの慣習に対して inbox note 群が違反しているか」のような比較ができる。target を schema scope から除外することで、対象 note 自身が coverage を押し上げて self-justify することを避ける。

## Output model

`schema` は Obsidian 由来の型情報と、出現値から見た実際の値 shape を分けて返す。

- `obsidian_type`
  - `MetadataCache.getAllPropertyInfos()` の type を正規化せず保持する
  - 例: `text`, `number`, `checkbox`, `date`, `datetime`, `aliases`, `tags`
- `value_shape`
  - AI や formatter が扱いやすい shape
  - 例: `string`, `number`, `boolean`, `string-array`, `null`, `mixed`, `unknown`

この二層化により、Obsidian の property metadata を失わずに、推論結果を他 command で再利用しやすくする。

`group-by` なしの infer は単一 summary を返し、`group-by` ありの infer は group ごとの summary を返す。

### Infer JSON contract

```ts
type SchemaSummary = {
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
	};
	properties: SchemaPropertySummary[];
};

type SchemaPropertySummary = {
	key: string;
	obsidianType: string | null;
	valueShape: "string" | "number" | "boolean" | "string-array" | "null" | "mixed" | "unknown";
	presentIn: number;
	noteCount: number;
	coverage: number;
	exampleValues: string[];
	enumCandidates?: string[];
	formatHint?: "date" | "datetime" | "wikilink-list" | null;
	warnings: SchemaPropertyWarning[];
};

type SchemaPropertyWarning = {
	type: "possible_duplicate_of";
	detail: string;
};
```

text 出力は人間向けの summary、tsv 出力は automation 向けの flat row とする。

`exampleValues` は最大 3 件の distinct 値だけを返す。複合値は compact JSON の 1 行文字列へ正規化し、canonical string 昇順で安定化する。

`properties` の並び順は formatter に依らず key の昇順で固定する。coverage 順にはしない。差分の安定性を優先し、consumer が必要なら後段で並べ替える。`grouped infer` の group 順も value 昇順で固定する。`missing.paths` と `validate.results` も path 昇順で固定する。

```tsv
key	obsidian_type	value_shape	present_in	note_count	coverage	enum_candidates	warnings
tags	tags	string-array	243	248	0.98	project,idea,reference	
status	text	string	179	248	0.72	todo,in-progress,done,archived	
created	date	string	30	248	0.12		possible_duplicate_of:date
```

### Grouped infer JSON contract

```ts
type GroupedSchemaSummary = {
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
	};
	groupBy: {
		kind: "folder" | "tag" | "property";
		key: string | null;
		mode: "partition" | "overlap";
		unassignedCount: number;
	};
	groups: SchemaGroupSummary[];
};

type SchemaGroupSummary = {
	value: string;
	noteCount: number;
	properties: SchemaPropertySummary[];
};
```

- `groupBy.mode`
  - `folder` と `property:<key>` は `partition`
  - `tag` は 1 note が複数 group に入るため `overlap`
- `groupBy.unassignedCount`
  - `group-by=tag`: tag を 1 つも持たない note 数
  - `group-by=property:<key>`: key がない、または scalar でない note 数
  - `group-by=folder`: 常に `0`

`format=tsv` では infer の flat row に `group_by_kind`, `group_by_key`, `group_value`, `group_note_count` を先頭列として追加する。`group-by=tag` では 1 note が複数 group に現れるため、group 別 row 数の合計は scope の note 数と一致しない。

### Missing JSON contract

```ts
type MissingPropertyResult = {
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
	};
	key: string;
	missingCount: number;
	paths: string[];
	property: SchemaPropertySummary | null;
};
```

`format=tsv` では path だけを 1 行 1 path で返す。これは `xargs` や別 command への pipe を想定した最小表現にする。JSON の `property` は key が schema scope 内に 1 回以上現れたときのみ summary を入れ、catalog にだけ存在する key や未知 key では `null` とする。

### Validate JSON contract

```ts
type SchemaValidationBatchResult = {
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
	};
	targets: {
		paths: string[];
		noteCount: number;
	};
	failOn: "low" | "high" | "none";
	failed: boolean;
	results: SchemaValidationResult[];
};

type SchemaValidationResult = {
	path: string;
	valid: boolean;
	highestSeverity: "low" | "high" | null;
	issues: SchemaValidationIssue[];
	frontmatter: Record<string, unknown>;
};

type SchemaValidationIssue = {
	key: string;
	issue: "missing" | "type_mismatch" | "enum_mismatch" | "unusual_key" | "mixed_type";
	severity: "low" | "high";
	coverage?: number;
	expectedObsidianType?: string | null;
	expectedValueShape?: string | null;
	actualValueShape?: string | null;
	note?: string;
};
```

`valid` は note 単位で `issues.length === 0` を表し、process fail 条件とは分離する。top-level の `failed` は `failOn` を適用した結果であり、`failOn=none` のときは常に `false` になる。`frontmatter` は分析用の正規化 view を返し、`tags` / `aliases` は array 形に揃える。

## Snapshot model

`schema` 実装の核心は command surface ではなく snapshot にある。初版では plugin 側で次のような Obsidian 依存 snapshot を作り、core 側へ渡す。

```ts
type VaultSchemaSnapshot = {
	propertyCatalog: Record<string, { obsidianType: string | null }>;
	notes: VaultSchemaNote[];
};

type VaultSchemaNote = {
	path: string;
	folder: string;
	tags: string[];
	frontmatter: Record<string, unknown>;
};
```

plugin 側の取得方針:

- `app.vault.getMarkdownFiles()` で対象 file 群を取る
- `app.metadataCache.getFileCache(file)` から frontmatter / tags を読む
- `app.metadataCache.getAllPropertyInfos()` から vault-wide property catalog を取る
- `tags` / `aliases` は snapshot 化時に array 形へ正規化する
- frontmatter 未定義 note は `frontmatter={}` として扱う

core 側はこの snapshot だけを入力に取り、Obsidian API を import しない。

## Schema inference algorithm

`group-by` ありの infer では、base scope を先に決めてから group を列挙し、各 group に対して同じ property inference を独立に適用する。

### Group construction

- `group-by=folder`
  - note の親 folder ごとに 1 group 作る
  - root folder の note は `value=""` に入れる
- `group-by=tag`
  - note の正規化済み tag ごとに 1 group 作る
  - 1 note が複数 tag を持つときは複数 group に所属する
  - tag を持たない note は `unassignedCount` のみ増やし、`null` group は作らない
- `group-by=property:<key>`
  - frontmatter 上の scalar 値ごとに 1 group 作る
  - 値の canonical 表現は `string` をそのまま、`number` / `boolean` は文字列化したものを使う
  - key 不在、`null`、array、object は `unassignedCount` のみ増やし、group は作らない

### 1. Property presence aggregation

各 note の frontmatter key を列挙し、key ごとに次を集計する。

- `presentIn`
- `coverage = presentIn / noteCount`
- `exampleValues`
- `distinctScalarValues`
- `valueShapeCounts`

`tags` と `aliases` は Obsidian の実挙動に合わせて snapshot 化時に array へ正規化する。

それ以外の key は frontmatter 由来の値をそのまま読み、Obsidian catalog 側の type で補強する。

### 2. Type resolution

property row の型は次の順で決める。

1. `propertyCatalog[key].obsidianType`
2. frontmatter 値から推論した `valueShape`
3. どちらも取れない場合は `null` / `unknown`

例:

- `obsidianType=text`, `valueShape=string`
- `obsidianType=tags`, `valueShape=string-array`
- `obsidianType=null`, `valueShape=null`
- `obsidianType=null`, `valueShape=mixed`

### 3. Enum candidate detection

`enumCandidates` は次のすべてを満たす場合にのみ返す。

- `valueShape === "string"`
- 非空の distinct value が 1 以上 10 以下
- 各 value が単一行かつ 80 文字以下
- coverage が 0.1 以上

date / datetime pattern に一致する値は enum 候補から除外し、代わりに `formatHint` に寄せる。

### 4. Format hint detection

string 系 property に対し、sample 値の過半数が一致したときに hint を付与する。

- `YYYY-MM-DD` -> `date`
- ISO 8601 日時 -> `datetime`
- `[[a]]`, `[[a]], [[b]]` のような wikilink list -> `wikilink-list`

hint は informational であり validation error の根拠にはしない。

### 5. Duplicate warning detection

`possible_duplicate_of` は low severity の heuristic warning としてのみ出す。v1 では次のいずれかを満たすとき候補にする。

- key 正規化後に一致する
  - 例: `created-at` と `created_at`
- key 正規化後の類似度が高く、かつ `valueShape` が一致する
  - 例: `project` と `projects`

synonym family の手管理テーブルは v1 では導入しない。semantic duplicate 判定は説明用 warning に留め、missing / validate の hard rule には使わない。

## Validation algorithm

validate は 1 つ以上の note を「このスコープで一般的な schema に照らして変ではないか」で判定する。修正提案までは行わない。

### Rule selection

validation 対象 property は次のいずれかを満たす row に限定する。

- `coverage >= missingThreshold`
- 対象 note がその key を持っている

この条件により、低頻度 property による missing ノイズを抑えつつ、対象 note 上の unusual key は拾える。

### Issue rules

- `missing`
  - 対象 note が key を持たず、schema coverage が `missingThreshold` 以上
- `type_mismatch`
  - 対象 note の値 shape が schema row の主要 shape と一致しない
- `enum_mismatch`
  - schema row に enum 候補があり、対象 note の scalar 値がそこに含まれない
- `unusual_key`
  - duplicate warning がある key では `coverage < 0.15` を low coverage とみなす
  - duplicate warning がない key では `coverage < 0.05` または `presentIn <= 3` を low prevalence とみなす
  - 上記いずれかを満たす対象 note 上の key を issue にする
- `mixed_type`
  - infer 結果の `valueShape` が `mixed` の key に対して出す
  - canonical shape を決めきれないため、この場合は `type_mismatch` を優先しない

### Severity

- `high`
  - `missing` かつ coverage が `missingThreshold` 以上
  - `type_mismatch` で canonical shape が明確
  - `enum_mismatch`
- `low`
  - `unusual_key`
  - `mixed_type`

対象 note が frontmatter を持たない場合も valid JSON を返し、`frontmatter: {}` と `missing` issue 群を返す。`results` は path 昇順で安定化する。

## Formatter behavior

### text

- infer
  - 1 行目に scope summary
  - `group-by` ありでは `Schema inferred from N notes grouped by ...` を出し、各 group を見出しとして区切る
  - 続く各行で `key`, `valueShape`, `coverage`, `presentIn/noteCount`, optional enum / warning を表示
- missing
  - path 一覧を返し、末尾に `N notes are missing '<key>'.` を付ける
- validate
  - 1 行目に `Schema validation for N notes: pass|fail`
  - 各 note を path 昇順で表示し、issue を severity 順に列挙する

### json

- formatter だけでなく downstream command が consume しやすい stable key を優先する
- coverage は 0-1 の fraction で返す
- 文字列表現の percent は JSON に含めない

### tsv

- infer は header を常に付ける
- infer の `group-by` ありでは `group_by_kind`, `group_by_key`, `group_value`, `group_note_count` を追加する
- missing mode は path-only の 1 column TSV を header なしで返す
- tab, newline, carriage return を含む値はそれぞれ `\\t`, `\\n`, `\\r` に backslash escape する
- array 値は comma-joined string に flatten する

## Process contract

- machine-readable payload と通常の formatter 出力は stdout に出す
- usage error や runtime error の診断メッセージは stderr に出す
- exit code は次で固定する
  - `0`: 正常終了
  - `1`: `excli-schema:validate` が `failed: true` を返した
  - `2`: user input / usage error
  - `3`: runtime error

## Responsibilities

`schema` は command wrapper と reusable analysis module を分ける。

### Proposed structure

```text
docs/
  design/
    schema-command-design.md

packages/
  core/
    src/
      analysis/
        schema/
          types.ts
          inferSchema.ts
          findMissingProperties.ts
          validateNoteAgainstSchema.ts
          detectEnumCandidates.ts
          detectDuplicateProperties.ts
      commands/
        schema/
          index.ts
          parseOptions.ts
          formatInfer.ts
          formatMissing.ts
          formatValidate.ts
          types.ts

  plugin/
    src/
      analysis/
        buildVaultSchemaSnapshot.ts
        filterVaultSchemaSnapshot.ts
      commands/
        schema/
          index.ts
          spec.ts
          parseCliArgs.ts
          registerCliHandler.ts
          types.ts
```

### `packages/core/src/analysis/schema/`

- snapshot から schema row を推論する
- missing 判定と validation 判定を行う
- downstream command が再利用できる typed result を返す

### `packages/core/src/commands/schema/`

- raw option を command-aware input に正規化する
- infer / missing / validate の formatter を持つ
- plugin adapter が扱いやすい command result を返す

### `packages/plugin/src/analysis/`

- Obsidian API から snapshot を組み立てる
- folder / tag / path 解決を行う
- markdown file の存在確認と cache access を行う

### `packages/plugin/src/commands/schema/`

- `excli-schema:infer` / `:missing` / `:validate` の spec を提供する
- command ごとに CLI args を parse する
- core command API と Obsidian snapshot builder を接続する
- register 時に 3 つの CLI handler を個別に登録する

## Error handling and edge cases

- schema scope が 0 note の場合
  - infer: 空の summary を返す
  - infer + `group-by`: 空の `groups` を返す
  - missing: 空 list を返す
  - validate: user error にする。母集団が 0 では比較の意味が薄い
- `path` のいずれかが markdown note でない場合は error
- `validate` で scope と target が重なった場合、重なった note は schema scope から除外してから推論する
- `group-by=property:<key>` で key の値が array / object / null の note は group に入れず、`unassignedCount` にのみ加算する
- `excli-schema:missing` で `key` が catalog に存在しない場合でも error にはしない
  - 0 present の property とみなし、全 note を missing と判定する
- frontmatter parse 済みだが object でない異常値は `frontmatter={}` 扱いにフォールバックし warning を付ける
- `getAllPropertyInfos()` に存在するが snapshot 内には現れない property は infer 出力には含めない
  - `presentIn=0` row としては出さず、完全に除外する

## Testing strategy

core では pure test を優先する。

- infer
  - coverage 計算
  - enum 候補の抽出
  - `obsidianType` と `valueShape` の二層化
  - duplicate warning
  - `group-by=folder` の partition
  - `group-by=tag` の overlap
  - `group-by=property:type` の scalar grouping
  - `unassignedCount` の計算
- missing
  - no-frontmatter note を含む欠落判定
  - unknown key の扱い
- validate
  - high coverage missing
  - type mismatch
  - enum mismatch
  - unusual key のしきい値
  - infer で `valueShape=mixed` になった row から `mixed_type` issue が出ること
  - multi-note validate の batch result
  - `fail-on` ごとの exit 判定
  - empty scope error
- format
  - text / json / tsv の mode 別出力
  - infer の property 順序が key 昇順で安定すること
  - grouped infer の group 順序が value 昇順で安定すること
  - missing / validate の path 順序が安定すること

plugin 側では adapter test を行う。

- `MetadataCache` から snapshot を組み立てられること
- folder / tag filter が command ごとの意味に従って core input と一致すること
- `group-by=property:<key>` の key 解決が spec どおり動くこと
- vault-relative `path` 解決が spec どおり動くこと
- 3 つの command が個別に register されること
- CLI arg の command ごとの validation が spec どおり error になること

vault-facing な挙動を確認する場合は、[`docs/development-flow.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/development-flow.md) の workflow に従って development vault 上で次を検証する。

- 複数 note の frontmatter から coverage が安定して計算される
- `excli-schema:infer group-by=property:type format=json` が type ごとの grouped schema を返す
- `excli-schema:infer group-by=tag format=tsv` が group 列付きの flat row を返す
- `excli-schema:missing key=tags format=tsv` が header なし path-only 出力になる
- `excli-schema:validate path=... path=... format=json` が期待どおり batch result を返す
- `excli-schema:validate ... fail-on=high` が low-only issue では exit 0、high issue で exit 1 になる

## Rollout note

この設計では `schema` command 自体よりも snapshot と analyzer を先に固定する。次の順で導入するのが安全である。

1. `packages/core/src/analysis/schema` と plugin snapshot builder を作る
2. `excli-schema:infer` のみを先に接続する
3. `excli-schema:missing` と `excli-schema:validate` を追加する
4. `audit` と `impact` が同じ analyzer を consume する

これにより v1 を小さく始めつつ、proposal で意図されている analysis foundation への接続を崩さずに進められる。
