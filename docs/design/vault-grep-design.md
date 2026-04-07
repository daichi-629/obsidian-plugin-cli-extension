# Vault grep design

## Overview

Obsidian CLI handler 経由で vault 内のノートを検索する `grep` 類似機能を追加する。

- 対象は vault 内のテキストファイルのみ
- 初版は GNU `grep` 完全互換を目指さない
- 検索ロジックは `packages/core` に集約し、Obsidian 依存は `packages/plugin` に閉じ込める

## Goals

- CLI から vault 内ノートを検索できる
- 検索ロジックを Obsidian 非依存でテストできる
- 今の最小構成を崩さず拡張できる

## Non-goals

- GNU `grep` の完全互換
- バイナリファイルの検索
- 置換機能
- 高度な正規表現拡張や PCRE 依存機能

## Current structure

現状の責務分離は次のとおり。

- `packages/plugin/src/main.ts`
    - plugin lifecycle のみ
- `packages/plugin/src/cli/registerCliHandlers.ts`
    - Obsidian CLI handler の登録
- `packages/core/src/index.ts`
    - Obsidian 非依存のロジック

この分離を維持したまま検索機能を追加する。

## Proposed structure

```text
packages/
  core/
    src/
      grep/
        formatResults.ts
        index.ts
        searchText.ts
        types.ts
  plugin/
    src/
      cli/
        buildVaultSearchSource.ts
        registerCliHandlers.ts
docs/
  design/
    vault-grep-design.md
```

## Responsibilities

### `packages/core`

- パターンの解釈
- 行単位検索
- オプション解決
- 結果整形
- unit test

`core` は `obsidian` を import しない。

### `packages/plugin`

- CLI 引数の受け取り
- vault 内ファイルの列挙
- `--path` による vault 相対 prefix filter の適用
- ファイル内容の読み出し
- `SearchDocument` source の構築
- `core` の検索ロジック呼び出し
- CLI 向けレスポンス文字列の返却

plugin から core を使うときは、型・関数ともに `@sample/core` の公開 API 経由で import する。

## Command shape

既存 handler とは別に、検索専用の CLI handler を追加する。

- 推奨名: `sample-monorepo-plugin-grep`
- 理由: `grep` 単体名だと衝突しやすい

想定呼び出し例:

```bash
obsidian sample-monorepo-plugin-grep --pattern "foo"
obsidian sample-monorepo-plugin-grep --pattern "foo" --path daily --line-number
obsidian sample-monorepo-plugin-grep --pattern "TODO" --files-with-matches
```

## CLI parameter parsing

`registerCliHandlers.ts` は raw な `CliData` をそのまま core に渡さず、plugin 側で `SearchOptions` に正規化する。

- `CliData` は plugin adapter 専用の入力型として扱う
- hyphenated option は bracket access を前提に扱う
  - 例: `params["line-number"]`
- 実装では camelCase fallback も受ける
  - 例: `params["line-number"] ?? params.lineNumber`
- boolean flag は `true` / `"true"` を有効値として解釈し、未指定は `false`
- 数値 option は plugin 側で parse と validation を済ませてから core に渡す
- validation error は throw ではなく handler の return string として返す

この方針により、Obsidian CLI の生パラメータ表現の差分を `registerCliHandlers.ts` に閉じ込める。

## Supported options

初版で対応するオプションは次のとおり。

- `--pattern`
    - 必須
    - 検索パターン
- `--path`
    - 任意
    - vault 相対の検索対象パス接頭辞
- `--fixed-strings`
    - 任意
    - 正規表現ではなく部分一致として扱う
- `--ignore-case`
    - 任意
    - 大文字小文字を無視する
- `--line-number`
    - 任意
    - 行番号を出力する
- `--files-with-matches`
    - 任意
    - マッチしたファイルパスのみを出力する
- `--count`
    - 任意
    - ファイルごとのマッチ件数を出力する
- `--max-results`
    - 任意
    - 最大マッチ件数。到達した時点で早期終了する

次の組み合わせ制約を設ける。

- `--files-with-matches` と `--count` は同時指定しない
- `--pattern` 未指定はエラー

## Search targets

初版の対象ファイル:

- `.md`
- `.txt`

初版の除外対象:

- `.obsidian/`
- 上記以外の拡張子

理由:

- Obsidian プラグインとして最も自然な対象は Markdown ノート
- 不要なファイル走査を避けられる
- バイナリや設定ファイルへの誤爆を減らせる

`--path` filter は plugin 側のファイル列挙段階で適用する。core は Obsidian 非依存を保つため、filter 済みの `SearchDocument` だけを受け取る。

## Data model

```ts
export type SearchOptions = {
	pattern: string;
	pathPrefix?: string;
	fixedStrings: boolean;
	ignoreCase: boolean;
	lineNumber: boolean;
	filesWithMatches: boolean;
	count: boolean;
	maxResults?: number;
};

export type SearchDocument = {
	path: string;
	content: string;
};

export type SearchMatch = {
	path: string;
	line?: number;
	text: string;
};

export type SearchResult = {
	matches: SearchMatch[];
	filesScanned: number;
	matchedFiles: number;
	skippedFiles: number;
	stoppedEarly: boolean;
};
```

- `SearchMatch.line` は grep 互換に合わせて 1-indexed とする
- `line` は行番号を持つ出力モードでのみ使うため optional のまま維持する
- `filesScanned` は successfully read できて core が実際に走査したファイル数を表す
- `skippedFiles` は read error で読み飛ばした件数を表す
- `filesScanned` と `skippedFiles` は初版ではデフォルト出力に含めず、diagnostic と test assertion 用の情報として保持する

## Module interfaces

`buildVaultSearchSource.ts` は単なる補助ファイルではなく、plugin 側の file-system adapter を切り出すモジュールとして定義する。

```ts
export type VaultSearchSource = {
	documents: AsyncIterable<SearchDocument>;
	getSkippedCount(): number;
};

export function buildVaultSearchSource(
	plugin: Plugin,
	options: Pick<SearchOptions, "pathPrefix">
): VaultSearchSource;
```

- 対象拡張子の判定と `.obsidian/` 除外はこの module が担当する
- `pathPrefix` もここで適用する
- file content は lazy に読み出し、`documents` として逐次 yield する
- read failure はそのファイルを skip し、`getSkippedCount()` に集約する

`registerCliHandlers.ts` はこの source を core に渡し、最終的な CLI 出力文字列を組み立てる。

## Flow

1. CLI handler が raw `CliData` を受ける
2. plugin 側で `CliData` を `SearchOptions` に正規化する
3. `buildVaultSearchSource.ts` が vault 内の対象ファイルを列挙し、filter 済み `SearchDocument` source を構築する
4. `packages/core` の検索関数がその source を逐次 consume する
5. `core` が `SearchResult` を返す
6. plugin 側で CLI 出力用文字列へ整形し、必要なら skip warning を追記して返す

## Output format

デフォルト:

```text
path:matched line
```

`--line-number` 指定時:

```text
path:line:text
```

`--files-with-matches` 指定時:

```text
path
```

`--count` 指定時:

```text
path:count
```

0 件時は空文字列ではなく、CLI として分かりやすい固定文言を返す案を採る。

```text
No matches found.
```

必要であれば将来は exit code も検討するが、初版は handler の文字列返却に留める。

read error で skip したファイルがある場合は、末尾に warning を 1 行だけ追記する。

```text
(1 file skipped due to read error)
```

## Error handling

次のケースは明示的なエラーメッセージを返す。

- `--pattern` 未指定
- 不正な正規表現
- `--files-with-matches` と `--count` の同時指定
- 不正な `--max-results`

これらは exception を投げず、既存 handler と同様に CLI handler の return string として返す。

対象ファイルの一部読み込みに失敗した場合は、そのファイルをスキップして継続する。全体失敗にはしない。

## Performance

- `onload` 時には何もスキャンしない
- CLI 実行時にのみ走査する
- `maxResults` の global counter は `packages/core/src/grep/index.ts` が持つ
- `searchText.ts` は 1 document 単位の pure function とし、global counter は持たせない
- `index.ts` は `documents` を逐次 consume し、`maxResults` 到達時点で iteration を打ち切る
- まずは逐次処理にする
- 大規模 vault でボトルネックが見えたら並列化を検討する

## Testing strategy

主なテスト対象は `packages/core` とする。

- fixed string 検索
- regex 検索
- ignore case
- line number
- count
- files with matches
- maxResults
- invalid regex

`packages/plugin` は薄い adapter なので、次の観点に絞る。

- vault ファイルから `SearchDocument` を組み立てる
- 対象拡張子と除外パスの判定
- CLI オプション変換

## Implementation order

1. `packages/core/src/grep` を追加する
2. `packages/core` の unit test を追加する
3. `packages/plugin/src/cli/buildVaultSearchSource.ts` を追加する
4. `packages/plugin/src/cli/registerCliHandlers.ts` に grep handler を追加する

README への使用例追加は今回は行わない。
