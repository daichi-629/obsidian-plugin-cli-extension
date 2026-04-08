# Schema command design

## 目的

Obsidian CLI 拡張として `schema` command を追加し、vault 全体または限定スコープの frontmatter / properties を集計して、AI と人間の両方が扱える決定論的なスキーマ要約を返せるようにする。

この command は単独でも有用だが、[`analysis-foundation`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/feature-proposals/integrated/analysis-foundation.md) の最初の実装対象として設計する。`audit` や `impact` が同じ snapshot と schema 推論結果を再利用できることを前提に、command surface と共有基盤を分けて定義する。

## Overview

`schema` command は markdown note 群を走査し、各 note の frontmatter、Obsidian が把握している property type、タグ情報を 1 つの snapshot にまとめる。その上で次の 3 モードを提供する。

- infer: スコープ内で暗黙的に使われている property schema を要約する既定モード
- missing: 指定 property を持たない note を列挙する運用モード
- validate: 1 note の frontmatter をスコープ内 schema に照合する検査モード

狙いは次の 4 点。

- vault-wide な frontmatter 慣習を AI が読むための判断材料を作る
- `audit` の schema check と `impact` の schema regression 判定に流用できる core API を先に固める
- `MetadataCache` が持つ property type を活かしつつ、coverage や enum 候補のような vault 固有の統計を追加する
- `main.ts` には registration だけを残し、snapshot 取得と集計ロジックを command/module 単位に閉じ込める

## Goals

- vault 全体または folder / tag で絞った note 集合から schema を推論できる
- property ごとの coverage、出現 note 数、型、enum 候補、format hint、warning を返せる
- `missing=<key>` で欠落 note を script-friendly に列挙できる
- `validate path=<path>` で 1 note の frontmatter を schema に照合できる
- Obsidian の property type と、AI が扱いやすい値の shape を両方返せる
- 推論・欠落判定・バリデーションを `packages/core` の純粋関数として test できる
- 将来の `audit` / `impact` が再利用できる snapshot と schema analyzer を用意する

## Non-goals

- frontmatter の自動修正
- inline field や note body の自然言語から property を推論すること
- vault 間比較や時系列差分
- user-defined schema file を source of truth にすること
- semantic duplicate 判定の完全自動化

## Command shape

command 名は directory 名と揃えて `schema` とし、CLI handler 名は既存規約に合わせて `excli-schema` とする。

```text
obsidian excli-schema [folder=<path>] [tag=<tag>] [min-coverage=<0-100>] [format=<text|json|tsv>] [missing=<key>] [validate] [path=<path>]
```

### Execution modes

mode は専用 option の組み合わせから決定する。

- infer
  - 条件: `missing` も `validate` も指定しない
  - 返り値: schema summary
- missing
  - 条件: `missing=<key>` を指定し、`validate` を指定しない
  - 返り値: 指定 key を持たない note 一覧
- validate
  - 条件: `validate` と `path=<path>` を指定し、`missing` を指定しない
  - 返り値: note と schema の照合結果

### Option semantics

- `folder=<path>`
  - vault-relative folder prefix
  - infer / missing では対象 note 集合を絞る
  - validate では「参照 schema を作る母集団」を絞る。`path` 自体はこの filter 外でもよい
- `tag=<tag>`
  - `#` の有無を問わず受け取り、内部では leading `#` を除去して正規化する
  - note selection は `MetadataCache` から得られる note tag 集合に対して行う
- `missing=<key>`
  - 指定 key を持たない note を列挙する
  - key 比較は frontmatter key の大文字小文字を保持した完全一致ではなく、Obsidian property key と同じ case-sensitive key をそのまま用いる
- `validate`
  - boolean flag
  - `path=<path>` と組み合わせて 1 note を検査する
- `path=<path>`
  - validate 対象の markdown note
  - infer / missing では指定不可
- `min-coverage=<0-100>`
  - percentage integer
  - infer では表示対象 property を絞る
  - missing では summary 付加情報の対象 schema row を絞るが、欠落 note の選定自体は `missing=<key>` に従う
  - validate では「missing issue を出す対象 property」の下限として使う
  - default は mode ごとに分ける
    - infer / missing: `0`
    - validate: `60`
- `format=<text|json|tsv>`
  - default は `text`
  - infer: `text`, `json`, `tsv`
  - missing: `text`, `json`, `tsv`
  - validate: `text`, `json`
  - `validate format=tsv` は validation error

### Invalid combinations

- `missing` と `validate` の同時指定は error
- `validate` なのに `path` がない場合は error
- `path` があるのに `validate` がない場合は error
- `min-coverage` が 0 未満または 100 超過なら error

## Scope selection model

schema の母集団は「markdown file かつ vault config 配下ではない note」とする。初版では次を前提にする。

- 対象拡張子は `.md` のみ
- `vault/.obsidian/` 配下は常に除外する
- frontmatter が存在しない note も母数には含める
- `folder` は prefix match とし、`notes` と `notes/` は同じ folder に正規化する
- `tag` filter は OR ではなく単一 tag 指定のみを v1 とする

validate では 2 つの集合を区別する。

- schema scope: `folder` / `tag` filter 後の note 集合
- target note: `path` で指定された 1 note

この分離により、「project フォルダの慣習に対して inbox note が違反しているか」のような比較ができる。

## Output model

`schema` は Obsidian 由来の型情報と、出現値から見た実際の値 shape を分けて返す。

- `obsidian_type`
  - `MetadataCache.getAllPropertyInfos()` の type を正規化せず保持する
  - 例: `text`, `number`, `checkbox`, `date`, `datetime`, `aliases`, `tags`
- `value_shape`
  - AI や formatter が扱いやすい shape
  - 例: `string`, `number`, `boolean`, `string-array`, `mixed`, `unknown`

この二層化により、Obsidian の property metadata を失わずに、推論結果を他 command で再利用しやすくする。

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
	valueShape: "string" | "number" | "boolean" | "string-array" | "mixed" | "unknown";
	presentIn: number;
	noteCount: number;
	coverage: number;
	exampleValues: string[];
	enumCandidates?: string[];
	formatHint?: "date" | "datetime" | "wikilink-list" | null;
	warnings: SchemaPropertyWarning[];
};
```

text 出力は人間向けの summary、tsv 出力は automation 向けの flat row とする。

```tsv
key	obsidian_type	value_shape	present_in	note_count	coverage	enum_candidates	warnings
tags	tags	string-array	243	248	0.98	project,idea,reference	
status	text	string	179	248	0.72	todo,in-progress,done,archived	
created	date	string	30	248	0.12		possible_duplicate_of:date
```

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
	property?: SchemaPropertySummary | null;
};
```

`format=tsv` では path だけを 1 行 1 path で返す。これは `xargs` や別 command への pipe を想定した最小表現にする。

### Validate JSON contract

```ts
type SchemaValidationResult = {
	path: string;
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
	};
	valid: boolean;
	issues: SchemaValidationIssue[];
	frontmatter: Record<string, unknown>;
};

type SchemaValidationIssue = {
	key: string;
	issue: "missing" | "type_mismatch" | "enum_mismatch" | "unusual_key" | "mixed_type";
	severity: "low" | "medium" | "high";
	coverage?: number;
	expectedObsidianType?: string | null;
	expectedValueShape?: string | null;
	actualValueShape?: string | null;
	note?: string;
};
```

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
- frontmatter 未定義 note は `frontmatter={}` として扱う

core 側はこの snapshot だけを入力に取り、Obsidian API を import しない。

## Schema inference algorithm

### 1. Property presence aggregation

各 note の frontmatter key を列挙し、key ごとに次を集計する。

- `presentIn`
- `coverage = presentIn / noteCount`
- `exampleValues`
- `distinctScalarValues`
- `valueShapeCounts`

`tags` や `aliases` は frontmatter 由来の値をそのまま読み、Obsidian catalog 側の type で補強する。

### 2. Type resolution

property row の型は次の順で決める。

1. `propertyCatalog[key].obsidianType`
2. frontmatter 値から推論した `valueShape`
3. どちらも取れない場合は `null` / `unknown`

例:

- `obsidianType=text`, `valueShape=string`
- `obsidianType=tags`, `valueShape=string-array`
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
- 既知の小さな synonym family に入る
  - 例: `date`, `created`, `created_at`

semantic duplicate 判定は説明用 warning に留め、missing / validate の hard rule には使わない。

## Validation algorithm

validate は 1 note を「このスコープで一般的な schema に照らして変ではないか」で判定する。修正提案までは行わない。

### Rule selection

validation 対象 property は次のいずれかを満たす row に限定する。

- `coverage >= minCoverage`
- 対象 note がその key を持っている

この条件により、低頻度 property による missing ノイズを抑えつつ、対象 note 上の unusual key は拾える。

### Issue rules

- `missing`
  - 対象 note が key を持たず、schema coverage が `minCoverage` 以上
- `type_mismatch`
  - 対象 note の値 shape が schema row の主要 shape と一致しない
- `enum_mismatch`
  - schema row に enum 候補があり、対象 note の scalar 値がそこに含まれない
- `unusual_key`
  - 対象 note 上の key coverage が低く、同時に duplicate warning を持つか、catalog 上でも低 prevalence と判断できる
- `mixed_type`
  - スコープ内で同一 key の value shape が分散し、canonical shape を決めきれない

### Severity

- `high`
  - `missing` かつ coverage >= 0.8
  - `type_mismatch` で canonical shape が明確
- `medium`
  - `missing` かつ 0.6 <= coverage < 0.8
  - `enum_mismatch`
  - `mixed_type`
- `low`
  - `unusual_key`
  - `missing` かつ 0.6 未満だが `minCoverage` を満たす

対象 note が frontmatter を持たない場合も valid JSON を返し、`frontmatter: {}` と `missing` issue 群を返す。

## Formatter behavior

### text

- infer
  - 1 行目に scope summary
  - 続く各行で `key`, `valueShape`, `coverage`, `presentIn/noteCount`, optional enum / warning を表示
- missing
  - path 一覧を返し、末尾に `N notes are missing '<key>'.` を付ける
- validate
  - 1 行目に `Schema validation for <path>: valid|invalid`
  - issue を severity 順に列挙する

### json

- formatter だけでなく downstream command が consume しやすい stable key を優先する
- coverage は 0-1 の fraction で返す
- 文字列表現の percent は JSON に含めない

### tsv

- header を常に付ける
- missing mode だけは path-only の 1 column TSV を許可する
- array 値は comma-joined string に flatten する

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
          formatResult.ts
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

- raw option を mode-aware input に正規化する
- infer / missing / validate の formatter を持つ
- plugin adapter が扱いやすい command result を返す

### `packages/plugin/src/analysis/`

- Obsidian API から snapshot を組み立てる
- folder / tag / path 解決を行う
- markdown file の存在確認と cache access を行う

### `packages/plugin/src/commands/schema/`

- CLI args を parse する
- command spec を提供する
- core command API と Obsidian snapshot builder を接続する

## Error handling and edge cases

- schema scope が 0 note の場合
  - infer: 空の summary を返す
  - missing: 空 list を返す
  - validate: user error にする。母集団が 0 では比較の意味が薄い
- `path` が markdown note でない場合は error
- `missing=<key>` で catalog に存在しない key を指定しても error にはしない
  - 0 present の property とみなし、全 note を missing と判定する
- frontmatter parse 済みだが object でない異常値は `frontmatter={}` 扱いにフォールバックし warning を付ける
- `getAllPropertyInfos()` に存在するが snapshot 内には現れない property は infer 出力には含めない

## Testing strategy

core では pure test を優先する。

- infer
  - coverage 計算
  - enum 候補の抽出
  - `obsidianType` と `valueShape` の二層化
  - duplicate warning
- missing
  - no-frontmatter note を含む欠落判定
  - unknown key の扱い
- validate
  - high coverage missing
  - type mismatch
  - enum mismatch
  - unusual key
  - empty scope error
- format
  - text / json / tsv の mode 別出力

plugin 側では adapter test を行う。

- `MetadataCache` から snapshot を組み立てられること
- folder / tag filter が core input と一致すること
- CLI arg の invalid combination が spec どおり error になること

vault-facing な挙動を確認する場合は、[`docs/development-flow.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/development-flow.md) の workflow に従って development vault 上で次を検証する。

- 複数 note の frontmatter から coverage が安定して計算される
- `missing=tags format=tsv` が path-only 出力になる
- `validate path=... format=json` が期待どおり issue を返す

## Rollout note

この設計では `schema` command 自体よりも snapshot と analyzer を先に固定する。次の順で導入するのが安全である。

1. `packages/core/src/analysis/schema` と plugin snapshot builder を作る
2. `schema` command を `infer` mode のみで接続する
3. `missing` と `validate` を追加する
4. `audit` と `impact` が同じ analyzer を consume する

これにより v1 を小さく始めつつ、proposal で意図されている analysis foundation への接続を崩さずに進められる。
