# Render template command design

## 目的

Obsidian CLI 拡張として `render-template` command を追加し、Eta を使った高機能 template から 1 つ以上の vault file を安全に生成できるようにする。

この command は [`command-oriented-folder-structure`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/design/command-oriented-folder-structure.md) と [`command-spec-co-location`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/design/command-spec-co-location.md) の原則に従い、command 単位で `packages/core` と `packages/plugin` に責務を分離する。

狙いは次の 5 点。

- vault 内の note/template 自動生成を CLI から再現可能にする
- `if` / `for` / `include` を template file に自然に書けるようにする
- template file 内に inline script を書き、render 前に data を動的に構築できるようにする
- inline script から `app` と `obsidian` API を利用できるようにする
- Obsidian 側には template source / vault I/O / script runtime / path safety を残し、`main.ts` を肥大化させない

## Overview

`render-template` command は template file または template bundle directory を読み取り、必要に応じて template file 先頭の inline script block を評価して render context を補強し、Eta で content と output path を render して vault に書き込む。

想定利用例:

```bash
obsidian excli-render-template template=daily.md.eta output='daily/<%= it._system.date %>-<%= it.path.id("note") %>.md' var=title=Daily
obsidian excli-render-template template=meeting-notes data-file=vault:data/meeting.json frontmatter-source=people/alice.md dry-run
obsidian excli-render-template template=project-scaffold output-root='projects/<%= it.path.slug(it.data.title) %>-<%= it.path.shortId() %>' var=title=Atlas overwrite=replace json
```

初版では text file を対象にし、binary asset は扱わない。
高機能さは template language の複雑化ではなく、bundle manifest、複数 data source、partial、path rendering、inline script によって実現する。

## Goals

- Eta を使って markdown / text 向け template を render できる
- single-file template と multi-file bundle の両方を扱える
- template 内で `if` / `for` / `const` など通常の JavaScript 構文を使える
- content だけでなく output path と file name も template として render できる
- CLI vars、JSON data file、既存 note front matter を 1 つの render context に統合できる
- trusted local JavaScript を inline script block として評価して render context を動的に構築できる
- inline script から `app` と `obsidian` API を利用できる
- partial を使って template を分割できる
- file name に自動 ID や衝突回避 suffix を付けられる
- dry-run と JSON summary により automation しやすくする
- core の主要ロジックを Obsidian 非依存で test できる

## Non-goals

- untrusted third-party template script の sandbox 実行
- Templater 完全互換
- network 経由の data fetch
- binary file 生成や画像コピー
- command palette での対話入力 UI
- YAML manifest や独自 expression language の導入
- bundle ごとの外部 script file を v1 の必須要件にすること

## Why Eta

mustache 系では `if` や `for` を data 側の前処理に寄せる必要があり、template file に script を書きたいという要件と相性が悪い。

Eta を選ぶ理由は次のとおり。

- `EJS` に近い書き味で学習コストが低い
- `it` 経由の data 参照で template の依存が明示されやすい
- `include()` が素直で partial 設計に向く
- JavaScript 構文をそのまま使えるため、`if` / `for` / `map` 程度の記述が自然
- Obsidian plugin で必要な「少量のロジックを template file に同居させる」用途に合う

## Command shape

CLI command 名は command directory 名と揃えて `render-template` とする。

- core: `packages/core/src/commands/render-template/`
- plugin: `packages/plugin/src/commands/render-template/`
- doc: `docs/design/render-template-command-design.md`

CLI handler 名の推奨:

- `excli-render-template`

理由:

- `render-template` 単体名は衝突しやすい
- plugin 固有 prefix を付けた方が CLI automation 時に判別しやすい
- 既存の `excli-grep` と命名規則を揃えられる

## Proposed structure

```text
docs/
  design/
    render-template-command-design.md

packages/
  core/
    src/
      commands/
        render-template/
          index.ts
          types.ts
          parseOptions.ts
          parseManifest.ts
          parseInlineScript.ts
          mergeData.ts
          buildTemplateRuntime.ts
          renderBundle.ts
          validateRenderedPaths.ts
          formatResult.ts
    __tests__/
      commands/
        render-template/
          parseManifest.test.ts
          parseInlineScript.test.ts
          mergeData.test.ts
          renderBundle.test.ts
          validateRenderedPaths.test.ts
          formatResult.test.ts

  plugin/
    src/
      commands/
        render-template/
          index.ts
          types.ts
          spec.ts
          parseCliArgs.ts
          resolveTemplateSource.ts
          resolveDataSources.ts
          runInlineScript.ts
          buildObsidianTemplateApi.ts
          applyRenderPlan.ts
          registerCliHandler.ts
      settings/
        templateCommand.ts
```

Eta の runtime dependency は `packages/core` に追加する。
plugin 側は `@sample/core` の render API だけに依存し、Eta を直接 import しない。

## Responsibilities

### `packages/core/src/commands/render-template/`

Obsidian 非依存の command logic を置く。

- typed input の validation
- bundle manifest の parse
- inline script block の抽出
- data source の deep merge
- Eta 用 render input の組み立て
- content / path template の render
- rendered output path の文法検証
- dry-run / json / plain-text 向け結果整形

ここでは `obsidian` を import しない。

### `packages/plugin/src/commands/render-template/`

Obsidian 側 adapter を置く。

- raw `CliData` の解釈
- template id から vault path への解決
- template file / bundle file 群の読み出し
- `data-file` と `frontmatter-source` の解決
- inline script の evaluation
- script に `app` と `obsidian` API を expose する bridge の構築
- vault 相対 path の安全確認
- render 結果の write / overwrite / skip
- core の結果を CLI handler の return string に変換

vault API と path policy は plugin 側に閉じ込める。

## Template modes

### 1. single-file mode

`template=<vault-path>` が file を指す場合、その file を 1 つの template として扱う。

- `output` が必須
- file content と `output` の両方を Eta で render する
- file 先頭に `template-script` block があれば先に評価する
- `stdout` 指定時は write を行わず rendered content をそのまま返す

single-file mode は最小の note 生成用であり、bundle mode の entry point を増やさず簡単に使えることを重視する。

### 2. bundle mode

`template=<template-id|vault-dir>` が directory を指す場合、その配下の `template.json` を manifest として扱う。

- manifest 内で複数 output を定義できる
- `partialsDir` で partial root を宣言できる
- `defaultDataFiles` と `defaults` により bundle 内 default data を持てる
- 各 template file に inline script block を書ける
- `output-root` を指定すると manifest の各 `path` の先頭に prefix できる

高機能 template は bundle mode を中心に設計する。

## Template syntax

Eta では template file に通常の JavaScript を埋め込める。

例:

```eta
<% if (it.data.published) { %>
Published
<% } else { %>
Draft
<% } %>

<% for (const item of it.data.items) { %>
- <%= item %>
<% } %>
```

data 参照は原則として `it` 経由に統一する。
これにより、template 内の値が render input 由来であることを明確にする。

## Inline script model

template file 先頭に次の fenced code block を 1 つだけ置ける。

````md
```template-script
export async function buildContext(api) {
	const activeFile = api.app.workspace.getActiveFile();
	return {
		activeFilePath: activeFile?.path ?? null,
		titleSlug: api.helpers.slug(api.data.title ?? "")
	};
}
```

# <%= it.data.title %>

Active: <%= it.script.activeFilePath %>
````

制約:

- inline script block は file 先頭に 1 個まで
- block の language id は `template-script`
- block を取り除いた残りを Eta template として render する
- partial file では inline script を禁止する
- bundle mode では output template ごとに独立して inline script を持てる

inline script は次の export を持てる。

```ts
export async function buildContext(
	api: TemplateScriptApi
): Promise<Record<string, unknown> | void>;
```

返り値は `it.script` に格納する。
root namespace に直接 merge しないことで、script 由来の値と user data を区別しやすくする。

## Bundle manifest

bundle root の `template.json` は次を source of truth とする。

```json
{
  "version": 1,
  "description": "Project scaffold",
  "partialsDir": "partials",
  "defaults": {
    "status": "draft"
  },
  "defaultDataFiles": ["defaults/project.json"],
  "outputs": [
    {
      "template": "README.md.eta",
      "path": "README.md"
    },
    {
      "template": "notes/index.md.eta",
      "path": "notes/<%= it.path.slug(it.data.title) %>-<%= it.path.shortId() %>.md"
    }
  ]
}
```

manifest の制約:

- `version` は初版では `1` 固定
- `outputs` は 1 件以上必須
- `template` は bundle root からの相対 path
- `path` は vault 相対 path ではなく bundle 内の相対出力 path template
- `partialsDir` 未指定時は partial 不使用として扱う
- `defaultDataFiles` は JSON file に限定する

manifest に条件式は持ち込まない。
条件分岐や繰り返しは Eta template 側で表現する。

## Data sources

render input は次の source をマージして構築する。

1. bundle manifest の `defaults`
2. bundle manifest の `defaultDataFiles`
3. CLI `data-file`
4. CLI `frontmatter-source`
5. CLI `data`
6. CLI `var`
7. inline script の `buildContext()` result
8. system / helper namespace の注入

後勝ちの precedence とし、object は deep merge、array は後勝ち置換とする。

ただし render 時の namespace は次に分離する。

```ts
type TemplateRenderInput = {
	data: Record<string, unknown>;
	source?: SourceContext;
	script: Record<string, unknown>;
	_system: {
		nowIso: string;
		date: string;
		time: string;
		timestamp: number;
	};
	helpers: {
		slug(value: string): string;
		wikilink(value: string): string;
		lower(value: string): string;
		upper(value: string): string;
		trim(value: string): string;
	};
	path: {
		slug(value: string): string;
		id(prefix?: string): string;
		shortId(): string;
		sequence(): number;
		extname(path: string): string;
		basename(path: string): string;
		dirname(path: string): string;
		join(...parts: string[]): string;
	};
};
```

template では原則として `it.data.title` や `it.script.activeFilePath` のように参照する。
path 構築は `it.path.*` に寄せ、文字列連結や独自 slug 化を template ごとにばらけさせない。

## Dynamic output path design

output path は Eta template として評価し、file name の自動構築を正式にサポートする。

主なユースケース:

- title から slug を作って file name に使う
- note ごとに一意な ID を suffix として付ける
- bundle 内の複数 file に連番を振る
- date + slug + short id のような規則を共通化する

例:

```eta
notes/<%= it.path.slug(it.data.title) %>-<%= it.path.shortId() %>.md
people/<%= it.path.id("person") %>.md
journal/<%= it._system.date %>-<%= it.path.sequence() %>.md
```

### Path helper policy

`it.helpers` は本文向けの text helper とし、path 専用 helper は `it.path` に分ける。
これにより、「本文用の文字列変換」と「vault path を組み立てる処理」を区別する。

初版で提供する path helper:

- `it.path.slug(value)`
    - file name 安全な slug を返す
- `it.path.id(prefix?)`
    - 長めの安定一意 ID を返す
- `it.path.shortId()`
    - file name suffix 向けの短い ID を返す
- `it.path.sequence()`
    - 同一 render 実行中の 1-based 連番を返す
- `it.path.extname(path)`
    - 拡張子を返す
- `it.path.basename(path)`
    - basename を返す
- `it.path.dirname(path)`
    - dirname を返す
- `it.path.join(...parts)`
    - path segment を安全に結合する

`id()` と `shortId()` は 1 回の render 実行中に固定値ではなく、呼ぶたびに新しい値を返す。
同じ file path template 内で複数回呼ぶと別値になるため、同一 ID を content と path の両方で使いたい場合は inline script で先に生成して `it.script.generatedId` に保存する。

### ID generation policy

自動 ID は「人が読める slug の補助」として付ける。
file name 全体を opaque identifier のみにすることは推奨しない。

推奨パターン:

```eta
<%= it.path.slug(it.data.title) %>-<%= it.path.shortId() %>.md
<%= it._system.date %>-<%= it.path.id("daily") %>.md
```

`shortId()` は可読性重視、`id(prefix)` は安定なユニーク性重視とする。
実装候補:

- `shortId()`: 6 から 8 文字程度の base36 / nanoid 互換文字列
- `id(prefix)`: `${prefix}-${timestamp}-${random}` 形式

v1 では deterministic ID は goal にしない。
同じ入力から常に同じ file name を得たい場合は、inline script で独自計算して `it.script` に格納する。

### Collision policy

自動 ID がない path template では file name collision が起きやすいため、生成後の path に対して明示的な衝突ポリシーを持つ。

```ts
type PathConflictPolicy = "fail" | "suffix" | "overwrite";
```

- `fail`
    - 既存 file と衝突したら失敗する
- `suffix`
    - `-2`, `-3` のような numeric suffix を付けて再解決する
- `overwrite`
    - `overwrite=replace` と同義で既存 file を置き換える

初版では CLI option として `path-conflict` を追加する。
default は `fail` とし、自動 rename は opt-in にする。

`suffix` の例:

- `notes/atlas.md`
- `notes/atlas-2.md`
- `notes/atlas-3.md`

この suffix 解決は `shortId()` や `id()` の代替ではなく、ユーザーが ID を書かなかった場合の救済として位置づける。

## `data-file`

`data-file` は comma-separated list を受け付け、各 entry は JSON file とする。

- `vault:templates/data/project.json` のような `vault:` prefix は vault relative path
- prefix なし相対 path は `process.cwd()` 基準の filesystem path
- 絶対 path は vault root または `process.cwd()` 配下にある場合のみ許可する

## `frontmatter-source`

`frontmatter-source` は vault 内 markdown file を受け付ける。
plugin 側で file を読み取り、front matter と body を抽出して `it.source` に入れる。

```ts
type SourceContext = {
	path: string;
	basename: string;
	frontmatter: Record<string, unknown>;
	body: string;
};
```

## `data`

`data` は inline JSON object を受け付ける。
小さな automation 用の shortcut とし、複雑な data は `data-file` を推奨する。

## `var`

`var` は `key=value[,key=value...]` 形式の convenience option とする。

- `key` は dotted path を許可する
- `value` は `true` / `false` / `null` / integer / float を scalar として解釈する
- comma や複雑な object が必要な場合は `data` または `data-file` を使う

例:

```bash
obsidian excli-render-template template=daily.md.eta output='daily/<%= it._system.date %>-<%= it.path.shortId() %>.md' var=title=Daily,count=3,published=true
```

## Exposed Obsidian API

inline script には次の API を渡す。

```ts
type TemplateScriptApi = {
	app: App;
	obsidian: typeof import("obsidian");
	input: {
		template: string;
		mode: "single-file" | "bundle";
		output?: string;
		outputRoot?: string;
		dryRun: boolean;
	};
	data: Record<string, unknown>;
	source?: SourceContext;
	system: {
		nowIso: string;
		date: string;
		time: string;
		timestamp: number;
	};
	helpers: {
		slug(value: string): string;
		wikilink(value: string): string;
		lower(value: string): string;
		upper(value: string): string;
		trim(value: string): string;
	};
	path: {
		slug(value: string): string;
		id(prefix?: string): string;
		shortId(): string;
		sequence(): number;
		extname(path: string): string;
		basename(path: string): string;
		dirname(path: string): string;
		join(...parts: string[]): string;
	};
	vault: {
		read(path: string): Promise<string>;
		exists(path: string): Promise<boolean>;
		list(prefix?: string): Promise<string[]>;
	};
};
```

重要な前提として、inline script は trusted local code と見なす。
この feature は sandbox ではなく automation を目的とするため、review していない third-party template を無条件に実行することは想定しない。

## Eta include policy

Eta の `include()` を partial 機構として使う。

- partial 名は bundle 内 `partialsDir` から相対名で解決する
- partial から bundle 外 file を読まない
- partial file では inline script を禁止する
- include 先にも `it` 全体を渡す

例:

```eta
<%~ include("./header", it) %>
```

single-file mode では `include()` を無効化するか、同一 directory 配下のみに制限する。
v1 では実装を簡単にするため、single-file mode の `include()` は無効でもよい。

## Data flow

1. CLI handler が raw `CliData` を受け取る
2. `parseCliArgs.ts` が plugin 用 typed input に正規化する
3. `resolveTemplateSource.ts` が single-file mode か bundle mode かを判定し、template text と manifest を読み出す
4. `resolveDataSources.ts` が `data-file` / `data` / `frontmatter-source` を読み出す
5. `core/parseOptions.ts` が必須値と option 組み合わせを検証する
6. `core/parseManifest.ts` が manifest を parse / validate する
7. `core/mergeData.ts` が static data source を deep merge する
8. `core/parseInlineScript.ts` が template 先頭の `template-script` block を抽出し、本体 template と分離する
9. plugin 側 `runInlineScript.ts` が `buildObsidianTemplateApi.ts` 経由で script を評価し、`it.script` 用 data を得る
10. `core/buildTemplateRuntime.ts` が `it.data` / `it.source` / `it.script` / `it._system` / `it.helpers` を組み立てる
11. path template 用に `it.path` helper と path conflict policy を解決する
12. `core/renderBundle.ts` が output path と content を Eta で render し、write plan を作る
13. `core/validateRenderedPaths.ts` が空 path、`..`、absolute path、重複 path を弾く
14. plugin 側 `applyRenderPlan.ts` が overwrite policy と path conflict policy に従って vault に write する
15. `core/formatResult.ts` が plain text または JSON summary を返す

## Option design

初版で対応する option は次のとおり。

- `template`
    - 必須
    - template id または template file / bundle directory path
- `output`
    - 任意
    - single-file mode の出力先
- `output-root`
    - 任意
    - bundle mode の各 output path に prefix する vault-relative root
- `path-conflict`
    - 任意
    - `fail | suffix | overwrite`
- `data-file`
    - 任意
    - JSON data file の comma-separated list
- `data`
    - 任意
    - inline JSON object
- `frontmatter-source`
    - 任意
    - render input に取り込む既存 note
- `var`
    - 任意
    - 簡易 scalar 指定
- `dry-run`
    - 任意
    - write を行わず計画だけ返す
- `stdout`
    - 任意
    - rendered content を標準出力向け文字列として返す
- `overwrite`
    - 任意
    - `fail | replace | skip`
- `json`
    - 任意
    - 結果を JSON で返す

組み合わせ制約:

- single-file mode では `output` または `stdout` のどちらか 1 つを必須とする
- single-file mode で `output` と `stdout` の同時指定はエラー
- bundle mode では `output` を禁止し、`output-root` のみ許可する
- bundle mode で `stdout` を使えるのは rendered output が 1 file のときだけとする
- `path-conflict=overwrite` は `overwrite=replace` を暗黙に要求する
- `overwrite` の default は `fail`

## Settings additions

template command 向けに plugin settings を追加する。

```ts
export type TemplateCommandSettings = {
	templateRoot: string;
	denyOutputPathPrefixes: string[];
	maxRenderedFiles: number;
};
```

default:

- `templateRoot`: `templates/`
- `denyOutputPathPrefixes`: `[".obsidian/"]`
- `maxRenderedFiles`: `20`

役割:

- bare `template=<id>` を `templateRoot/<id>` に解決する
- bundle の暴走で大量 file を生成することを防ぐ
- vault 内でも危険な書き込み先を拒否する

grep と同様、settings tab から変更できるようにするが、初版では allowlist policy までは導入しない。

## Path safety

path safety は plugin 側と core 側で二段に分けて守る。

### core 側

- rendered path が空文字でないこと
- absolute path でないこと
- `..` segment を含まないこと
- duplicate output path がないこと
- path helper が返した segment を正規化できること

### plugin 側

- vault relative path に解決できること
- `denyOutputPathPrefixes` に一致しないこと
- overwrite policy に反しないこと
- `path-conflict=suffix` のとき既存 file と衝突しない候補へ解決できること
- write 対象が text file として扱えること

この二段構えにより、bundle manifest が壊れていても vault 外への write を防ぐ。

## Result format

plain-text mode では次のような要約を返す。

```text
Rendered 2 files.
- README.md (created)
- notes/atlas.md (replaced)
```

`dry-run` 時は `created` / `replaced` の代わりに `planned` を返す。

`json` 時は次の shape を返す。

```ts
type RenderTemplateResult = {
	template: string;
	mode: "single-file" | "bundle";
	dryRun: boolean;
	files: Array<{
		path: string;
		template: string;
		status: "planned" | "created" | "replaced" | "skipped";
		bytes: number;
	}>;
};
```

automation 用には `json` を推奨する。

## Error contract

- 入力不正や policy 違反は user-facing な message を返す
- inline script の parse や `buildContext()` 失敗は file path と export 名を含む message に包む
- Eta render 中の未知エラーは `Template render failed unexpectedly.` として包む
- partial 解決失敗は bundle 全体を失敗にする
- overwrite policy が `skip` の場合だけ file 単位で `skipped` を許可する

代表的な error:

- `Template bundle is missing template.json.`
- `The --output option is required when template points to a file.`
- `Partial file "partials/header.eta" must not contain a template-script block.`
- `Rendered path "..." escapes the vault root.`
- `Bundle output count 24 exceeds maxRenderedFiles 20.`

## Testing strategy

### core unit test

- manifest parse
- inline script block extraction
- deep merge precedence
- `var` scalar coercion
- Eta `if` / `for` / `include` rendering
- output path render
- path helper による ID 生成
- `path-conflict=suffix` の再解決
- duplicate path detection
- `output-root` prefixing

### plugin test

- template id の `templateRoot` 解決
- `vault:` data-file 読み込み
- `frontmatter-source` 抽出
- inline script の load と `buildContext()` 実行
- script から `app` / `obsidian` / vault helper にアクセスできること
- 動的 file name が既存 file と衝突したときの `fail` / `suffix` / `overwrite` 分岐
- deny path prefix の enforcement
- overwrite policy ごとの write 挙動
- CLI handler の `stdout` / `json` / `dry-run` 分岐

## Manual verification

実装時は少なくとも次を確認する。

```bash
./bin/obsidian-dev pnpm run build
./bin/obsidian-dev pnpm run test
```

さらに vault で次を手動確認する。

- single-file mode で 1 note を生成できる
- bundle mode で複数 file を生成できる
- `.obsidian/` 配下への write が拒否される
- `frontmatter-source` の値が template から参照できる
- inline script から `app.vault` を使って追加 data を引ける
- `if` / `for` / `include` を含む Eta template が期待どおりに動く
- title から slug + short id を組み合わせた file name を生成できる
- `man` 出力が `spec.ts` と一致する

## Rollout plan

### Phase 1

- single-file mode
- `output`, `data`, `data-file`, `var`, `dry-run`, `stdout`
- Eta basic render
- inline `template-script` block
- dynamic output path と `it.path.shortId()`

### Phase 2

- bundle mode
- `include()` による partial
- `output-root`
- `path-conflict=suffix`
- JSON summary

### Phase 3

- settings tab integration
- `frontmatter-source`
- maxRenderedFiles guard
- Obsidian vault での manual verification 整備

この順序にすると、まず単一 note 生成の価値を出し、その後に高機能 bundle を足せる。
