# Render Template CLI redesign

## 目的

`render-template` command の CLI interface を、template mode の違いよりも「どこに書くか」「stdout に何を返すか」で理解できる形に整理する。

現行 interface には次の問題がある。

- `output` / `output-root` / `stdout` が別軸の概念なのに、help 上では同じ出力 interface に見える
- `path-conflict` と `overwrite` がどちらも衝突制御に見え、責務が分かりにくい
- `var`、`data-file`、`data`、`frontmatter-source` が並列に存在し、data source の mental model が複雑
- single-file mode と bundle mode の違いが command 名からは見えず、`template` の実体に暗黙依存している

この redesign では command は 1 つのまま維持し、template の実体を読んで mode を判定しつつ、利用者には mode ではなく execution semantics を見せる。

## 変更方針

### 維持するもの

- command 名は `excli-render-template` を維持する
- `template` は vault path または bare template id を受ける
- template file は single-file mode、template directory は bundle mode として扱う
- content / path rendering、inline template script、Eta runtime、bundle manifest の基本モデルは維持する

### 変えるもの

- `output` と `output-root` を廃止し、`destination` に統合する
- `stdout` boolean と `json` boolean を廃止し、`write` と `stdout` の二軸に分ける
- `var` を廃止し、`set` に統一する
- `frontmatter-source` を廃止する
- `data-file` の comma-separated syntax を廃止し、複数回指定にする
- `overwrite` を `existing-file` に改名する
- `path-conflict` を `duplicate-output` に改名する

## Proposed command shape

```text
obsidian excli-render-template \
  template=<path-or-id> \
  [destination=<path-template-or-root>] \
  [write=<apply|dry-run>] \
  [stdout=<status/text|status/json|content/text|status+content/text|status+content/json>] \
  [existing-file=<fail|replace|skip>] \
  [duplicate-output=<fail|suffix|overwrite>] \
  [data-file=<path>]... \
  [data=<json-object>] \
  [set=<key=value>]...
```

### Required arguments

- `template`

`template` は実際に vault 上で解決し、file なら single-file mode、directory なら bundle mode とみなす。

`destination` の意味は mode に応じて変わる。

- single-file mode: rendered file の出力 path template
- bundle mode: rendered file 群の出力 root directory

single-file mode では `destination` を必須にする。
bundle mode では `destination` を省略可能にする。
省略時は bundle manifest の相対 output path をそのまま vault root 基準で使う。

mode は user が指定しない。存在しない template は error にする。

## Output model

### `write`

`write` は vault への変更有無を決める。

- `write=apply`
    - vault に実際に書き込む
- `write=dry-run`
    - vault に書き込まない

default は `apply`。

`dry-run` flag は廃止し、`write` に統合する。

### `stdout`

`stdout` は CLI handler の返却内容を決める。

- `stdout=status/text`
    - 実行結果サマリだけを plain text で返す
- `stdout=status/json`
    - 実行結果サマリだけを JSON で返す
- `stdout=content/text`
    - rendered content だけを plain text で返す
- `stdout=status+content/text`
    - 実行結果サマリと rendered content を plain text で返す
- `stdout=status+content/json`
    - 実行結果サマリと rendered content を JSON で返す

default は `status/text`。

#### Semantics by mode

single-file mode:

- `content/*` は rendered file content を返す

bundle mode:

- `content/*` は rendered file ごとの content を返す
- plain text の場合は multi-part output にする

`stdout=content/text` は write の有無と独立して使える。
つまり次の 4 パターンを正面から表現できる。

- `write=apply stdout=status/text`
- `write=apply stdout=content/text`
- `write=dry-run stdout=status/text`
- `write=dry-run stdout=content/text`

`status+content/*` は debug / automation 向けの拡張モードとして残す。

## Data input model

CLI から渡す data source は次の 3 種類に限定する。

- `data-file=<path>`
- `data=<json-object>`
- `set=<key=value>`

### `data-file`

- 複数回指定可能
- filesystem path または `vault:` prefix を許可する
- file format は JSON object に限定する

例:

```text
data-file=shared.json data-file=vault:data/project.json
```

comma-separated syntax は廃止する。

### `data`

- 1 つの inline JSON object を受ける
- 文字列ではなく object であることを要求する

例:

```text
data='{"title":"Atlas","published":true}'
```

### `set`

- 複数回指定可能
- `key=value` を受ける
- dotted key を許可する
- scalar coercion は現行どおり `true` / `false` / `null` / number を認識する

例:

```text
set=title=Daily set=meta.owner=alice set=count=3
```

`var` は廃止する。

### Merge order

data source merge order は次で固定する。

1. bundle default data
2. `data-file` を指定順に apply
3. `data`
4. `set` を指定順に apply

最後に指定された `set` が最優先になる。

### Removed: `frontmatter-source`

`frontmatter-source` は削除する。

理由:

- CLI input source としては責務が特異で、一貫性を崩す
- `it.source` という別 namespace を導入し、template author に新しい mental model を強いる
- 既存 note の読み込みは inline template script 内の vault API で十分表現できる

既存 note を render input に使いたい場合は template script で明示的に読む。

## Conflict model

bundle mode では衝突が 2 種類あるため、引数を分けて残す。

### `duplicate-output`

同一 render run の中で、複数 output が同じ destination path に解決された場合の扱い。

- `fail`
- `suffix`
- `overwrite`

例:

- `README.md` を出す output が bundle 内に 2 つあり、どちらも `projects/atlas/README.md` に解決された

これは「今回生成した output 同士の衝突」であり、既存 vault file とは無関係。

### `existing-file`

最終 destination path に、vault 上の既存 file が存在した場合の扱い。

- `fail`
- `replace`
- `skip`

例:

- 今回の render 結果が `projects/atlas/README.md` に決まり、vault にすでにその file がある

これは「render 結果と既存 vault file の衝突」。

### Applicability

- `existing-file` は single-file mode / bundle mode の両方で有効
- `duplicate-output` は bundle mode のときだけ有効
- single-file mode で `duplicate-output` を指定した場合は validation error にする

## Examples

### single-file template

```bash
obsidian excli-render-template \
  template=daily-template.md \
  destination='daily/<%= it._system.date %>-<%= it.path.shortId() %>.md' \
  write=apply \
  stdout=status/text \
  data-file=vault:data/common.json \
  set=title=Daily
```

### single-file preview with rendered content

```bash
obsidian excli-render-template \
  template=meeting-template.md \
  destination='meetings/<%= it.path.slug(it.data.title) %>.md' \
  write=dry-run \
  stdout=content/text \
  data='{"title":"Weekly Sync"}'
```

### bundle render

```bash
obsidian excli-render-template \
  template=project-scaffold \
  destination='projects/atlas' \
  write=apply \
  stdout=status/text \
  existing-file=replace \
  duplicate-output=fail \
  data-file=project.json \
  set=owner=alice
```

### bundle preview with status and content

```bash
obsidian excli-render-template \
  template=project-scaffold \
  destination='projects/atlas-preview' \
  write=dry-run \
  stdout=status+content/json \
  data='{"title":"Atlas"}'
```

## Validation rules

- `template` は必須
- `destination` は必須

- `template` は existing vault file または directory に解決できなければならない
- `write` は `apply` または `dry-run`
- single-file mode では `destination` は必須
- bundle mode では `destination` は省略可能
- `stdout` は `status/text`、`status/json`、`content/text`、`status+content/text`、`status+content/json`
- `existing-file` は `fail`、`replace`、`skip`
- `duplicate-output` は `fail`、`suffix`、`overwrite`
- single-file mode では `duplicate-output` を指定できない
- `data` は JSON object でなければならない
- `data-file` の各 file は JSON object に parse できなければならない
- `set` は `key=value` 形式でなければならない

## Migration from current CLI

### Renames

- `output` -> `destination`
- `output-root` -> `destination`
- `overwrite` -> `existing-file`
- `path-conflict` -> `duplicate-output`
- `var` -> `set`
- `dry-run` -> `write=dry-run`
- `stdout` -> `stdout=content/text`
- `json` -> `stdout=status/json`

### Removals

- `frontmatter-source`
- comma-separated `data-file`
- comma-separated `var`

### Compatibility note

breaking change として入れるのが前提。

もし移行猶予を置くなら、旧 flag を一定期間だけ受け付けて deprecation error を返す。
ただし parse layer が複雑になるため、実装コストと UX の両方を考えると一括移行の方が望ましい。

## Finalized decisions

- status/content と text/json は別引数にせず、`stdout=<payload>/<format>` 形式で表す
- bundle mode の `stdout=content/text` は file delimiter を含む multi-part text で返す
- `destination` は bundle mode では省略可能にする

### Plain-text bundle content shape

bundle mode で `stdout=content/text` または `stdout=status+content/text` を指定した場合、plain text content は file ごとに区切って返す。

イメージ:

```text
=== file: projects/atlas/README.md ===
# Atlas

=== file: projects/atlas/docs/overview.md ===
Overview...
```

delimiter は human-readable かつ script でも分割しやすい固定形式にする。
