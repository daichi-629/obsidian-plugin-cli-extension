# Apply patch command design

## 目的

Obsidian CLI 拡張として `apply_patch` command を追加し、vault 内ファイルに対して Codex 互換の patch を安全に適用できるようにする。

この command は [`command-oriented-folder-structure`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/design/command-oriented-folder-structure.md) の原則に従い、command 単位で `packages/core` と `packages/plugin` に責務を分離する。

狙いは次の 3 点。

- Codex が生成する独自 `apply_patch` 形式を vault 内編集に再利用できる
- patch の parse / validate / apply を Obsidian 非依存で test できる
- Obsidian 側には CLI handler と vault adapter だけを残し、`main.ts` を肥大化させない

## Overview

`apply_patch` command は CLI 経由で patch 文字列を受け取り、vault 相対パスに対して file add / update / delete / rename を実行する。

想定利用例:

```bash
obsidian sample-monorepo-plugin-apply-patch --patch-file tmp/change.patch
obsidian sample-monorepo-plugin-apply-patch --patch "*** Begin Patch
*** Update File: notes/todo.md
@@
-old
+new
*** End Patch"
obsidian sample-monorepo-plugin-apply-patch --dry-run --patch-file vault:tmp/change.patch
```

初版では patch 形式を Codex の `apply_patch` 互換に限定する。
unified diff や Git patch は受け付けない。

## Goals

- Codex 互換 patch を parse して vault に適用できる
- add / update / delete / move を 1 command で扱える
- dry-run により書き込み前に結果を検証できる
- parse と apply の主要ロジックを `packages/core` で unit test できる
- plugin 側で vault 外への書き込みを防げる

## Non-goals

- Git patch や unified diff のサポート
- 3-way merge や conflict marker の解決
- binary file patch
- command palette からの対話編集 UI
- patch 本文への front matter 埋め込み

## Command shape

CLI command 名は command ディレクトリ名と揃えて `apply-patch` とする。

- core: `packages/core/src/commands/apply-patch/`
- plugin: `packages/plugin/src/commands/apply-patch/`
- doc: `docs/design/apply-patch-command-design.md`

CLI handler 名の推奨:

- `sample-monorepo-plugin-apply-patch`

理由:

- `apply_patch` 単体名は衝突しやすい
- plugin 固有 prefix を付けた方が CLI で判別しやすい

## Proposed structure

```text
docs/
  design/
    apply-patch-command-design.md

packages/
  core/
    src/
      commands/
        apply-patch/
          index.ts
          types.ts
          validateInput.ts
          parsePatch.ts
          planChanges.ts
          execute.ts
          formatResult.ts
    __tests__/
      commands/
        apply-patch/
          parsePatch.test.ts
          execute.test.ts
          formatResult.test.ts

  plugin/
    src/
      commands/
        apply-patch/
          index.ts
          types.ts
          parseCliArgs.ts
          buildVaultPatchSource.ts
          applyVaultPatchPlan.ts
          registerCliHandler.ts
```

## Responsibilities

### `packages/core/src/commands/apply-patch/`

Obsidian 非依存の command logic を置く。

- CLI 由来ではない typed input の validation
- patch 文字列の parse
- hunk 列の domain model 化
- file ごとの変更 plan 作成
- 既存 file content に対する chunk 適用
- dry-run 時の結果生成
- CLI 出力向け結果整形

ここでは `obsidian` を import しない。

### `packages/plugin/src/commands/apply-patch/`

Obsidian 側 adapter を置く。

- raw `CliData` の解釈
- `--patch` と `--patch-file` の入力解決
- vault 相対パスへの変換
- 実ファイルの読み出しと書き込み
- rename / delete / create の実行
- `core` の結果を CLI handler の return string に変換

vault API や path safety は plugin 側に閉じ込める。

## Data flow

1. CLI handler が raw `CliData` を受け取る
2. `parseCliArgs.ts` が plugin 用 typed input に正規化する
3. `buildVaultPatchSource.ts` が patch 本文を取得する
4. `core/validateInput.ts` が必須値と option 組み合わせを検証する
5. `core/parsePatch.ts` が Codex 互換 patch を parse する
6. `core/planChanges.ts` が file ごとの変更 plan を生成する
7. plugin 側が必要な既存 file content を読み込み、`core/execute.ts` に渡して更新後 content を計算する
8. plugin 側 `applyVaultPatchPlan.ts` が vault に対して add / write / rename / delete を実行する
9. `core/formatResult.ts` が CLI 向け要約文字列を返す

## Option design

初版で対応する option は次のとおり。

- `--patch`
    - 任意
    - patch 本文を直接渡す
- `--patch-file`
    - 任意
    - patch を含むテキストファイル
- `--dry-run`
    - 任意
    - 実際には書き込まず、適用計画のみ返す
- `--allow-create`
    - 任意
    - `Add File` を許可する。未指定時は拒否する
- `--verbose`
    - 任意
    - file ごとの処理結果を詳しく返す

組み合わせ制約:

- `--patch` と `--patch-file` のどちらか 1 つを必須とする
- `--patch` と `--patch-file` の同時指定はエラー

`--patch-file` の解決規則:

- `vault:notes/change.patch` のように `vault:` prefix がある場合は vault 相対パスとして `vault.adapter.read()` で読む
- prefix のない相対パスは `process.cwd()` 基準の filesystem path として読む
- 絶対パスは filesystem path として扱い、vault root または `process.cwd()` 配下にある場合のみ許可する
- 上記以外の vault 外絶対パスは拒否する

## Core domain model

```ts
export type ApplyPatchInput = {
	patchText: string;
	dryRun: boolean;
	verbose: boolean;
	allowCreate: boolean;
};

export type UpdateChunk = {
	context: string[];
	oldLines: string[];
	newLines: string[];
	isEndOfFile?: boolean;
};

export type ApplyPatchOperation =
	| { type: "add"; path: string; contents: string }
	| { type: "delete"; path: string }
	| {
			type: "update";
			path: string;
			moveTo?: string;
			chunks: UpdateChunk[];
	  };

export type ApplyPatchPlan = {
	operations: ApplyPatchOperation[];
};

export type ApplyPatchFileResult = {
	path: string;
	operation: "add" | "delete" | "update" | "move";
	status: "planned" | "applied" | "failed" | "skipped";
	message?: string;
};

export type ApplyPatchResult = {
	files: ApplyPatchFileResult[];
	changedFileCount: number;
	dryRun: boolean;
};
```

`path` は core でも相対パス文字列として保持し、filesystem path への解決は plugin 側でのみ行う。

`update.chunks` は空配列を許容するが、その場合は `moveTo` を伴う rename-only update として扱う。
`moveTo` なしで空配列なら parse error とする。

## Patch format support

受け付ける patch 形式は Codex 互換の独自 `apply_patch` に限定する。

- `*** Begin Patch` / `*** End Patch`
- `*** Add File:`
- `*** Delete File:`
- `*** Update File:`
- 任意の `*** Move to:`
- `@@` 文脈行
- `+` / `-` / ` ` line
- 任意の `*** End of File`

詳細な grammar は [`apply-patch-tool-design.md`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/design/apply-patch-tool-design.md) を参照する。

この command では front matter を patch metadata として解釈しない。
front matter は patch 外の transport 情報としても扱わない。

## Parsing strategy

`parsePatch.ts` は次で実装する。2. grammar 相当の最小 parser を TypeScript で実装する

理由:

- plugin runtime に Rust 実装を直接持ち込めない
- 必要な syntax は狭く、独自 parser の方が依存が少ない
- command 単位で test しやすい

ただし挙動は [`tool_apply_patch.lark`](/home/daichi/ghq/github.com/openai/codex/codex-rs/core/src/tools/handlers/tool_apply_patch.lark#L1) と整合させる。

parse 境界では patch 本文の改行を `CRLF` から `LF` に正規化する。

## Apply strategy

`core/execute.ts` は filesystem に直接触らず、`update` operation と現在の file content から更新後 content を計算する。

- input は `path`, `moveTo`, `chunks`, `currentContent` の組
- output は `nextContent` と、rename-only かどうかを含む typed result
- `chunks` が空で `moveTo` のみある場合は content を変更せず rename-only とみなす

plugin 側 `applyVaultPatchPlan.ts` は plan を受け、vault adapter を通じて次を行う。

- `add`
    - 親ディレクトリが必要なら作成する
    - 既存ファイルがある場合は失敗とする
- `delete`
    - 対象ファイルの存在確認後に削除する
- `update`
    - 現在内容を読み込み、`LF` に正規化して `core/execute.ts` に渡す
    - 返ってきた `nextContent` を元ファイルの改行コードに合わせて書き戻す
- `move`
    - rename 後の path が vault 内に収まることを確認する
    - rename-only では content 書き換えを行わない
    - 内容変更と rename が同時にある場合は 1 transaction 相当で扱う

Obsidian API が transaction を提供しない場合、同一 command 内で部分失敗しうる。
そのため初版では「失敗時にそこで停止し、未適用ファイルを `skipped` として返す」方針にする。

## Vault safety

plugin 側で次を必ず検証する。

- patch 内の対象 path と `Move to` 先は相対パスのみ受け付ける
- `--patch-file` の絶対パスは vault root または `process.cwd()` 配下のみ許可する
- `..` による vault 外参照を拒否する
- rename 先も同じく vault 内に限定する
- `.obsidian/` 配下は初版では編集対象から除外する

理由:

- plugin はローカル vault contents を扱うため、安全境界を plugin 側で保証する必要がある
- Codex 互換 patch は path grammar が広いため、runtime 側で明示的に絞る必要がある

## Error contract

`command-oriented-folder-structure` の契約に従う。

- `core` は user-facing な入力不正を `UserError` として返す
- `plugin` は `UserError` を CLI 向け文字列へ変換する
- 想定外エラーは file path と operation を添えて返す

主な user error:

- patch が空
- patch header が不正
- `--patch` と `--patch-file` の組み合わせが不正
- `Add File` があるのに `--allow-create` がない
- 文脈一致が見つからず update を適用できない
- vault 外 path を指定している
- 既存ファイルへの `Add File`
- 存在しないファイルへの `Delete File`
- `moveTo` を伴わない空 `Update File`

## Output format

デフォルト出力:

```text
Applied patch to 2 files.
Updated: notes/todo.md
Deleted: scratch/old.md
```

dry-run:

```text
Dry run completed. 2 file changes planned.
Update: notes/todo.md
Delete: scratch/old.md
```

部分失敗時の出力例:

```text
Patch partially applied. 1 of 3 files changed.
Updated: notes/todo.md
Failed: src/app.ts - context not found at @@ function greet
Skipped: scratch/old.md
```

verbose 時は file ごとの status と message を追加する。

## Testing strategy

`packages/core` の unit test で次をカバーする。

- valid patch の parse
- invalid marker の reject
- add / delete / update / move の plan 生成
- rename-only update の解釈
- `@@` 文脈行による一意な一致
- `*** End of File` を伴う末尾更新
- CRLF 入力の `LF` 正規化
- dry-run 結果整形

`packages/plugin` では必要最小限の integration test または手動確認を行う。

- CLI handler が `--patch-file` を読める
- `vault:` と filesystem path の両方で `--patch-file` を読める
- vault 内 file add / update / delete / move が正しく反映される
- vault 外 path を拒否する

## Implementation steps

1. `docs/design/apply-patch-command-design.md` を承認する
2. `packages/core/src/commands/apply-patch/` を追加する
3. parser と apply plan の unit test を追加する
4. `packages/plugin/src/commands/apply-patch/` を追加する
5. `packages/plugin/src/commands/index.ts` に登録する
6. `pnpm run test` と `pnpm run build` で確認する

## Open questions

- `.md` 以外のテキストファイルも更新対象に含めるか
  →含める
- `.obsidian/` 配下の明示許可フラグを用意するか
  →初版では除外
- 将来的に command palette から patch paste UI を追加するか
  →将来検討
