# Command-oriented folder structure

## 目的

この repository の Obsidian plugin は「Obsidian CLI を拡張する plugin」として育てる。
そのため、実装単位を `command` に揃え、各 command を別々に並列開発しやすい構成にする。

狙いは次の 3 点。

- command ごとの責務を明確にする
- `packages/core` と `packages/plugin` の境界を保つ
- 複数人が別 command を同時に実装しても競合しにくくする

## 設計原則

- `main.ts` は plugin lifecycle だけを持つ
- command ごとのロジックは command ディレクトリ配下に閉じ込める
- Obsidian 非依存ロジックは `packages/core` に置く
- Vault 読み出しや CLI handler 登録など Obsidian 依存処理は `packages/plugin` に置く
- command を追加するときは、原則として「新しい command ディレクトリを追加する」形にする
- command ごとの CLI 登録ファイル名は `registerCliHandler.ts` に統一する

## 推奨フォルダ構造

```text
docs/
  design/
    command-oriented-folder-structure.md
    grep.md
    <command-name>.md

packages/
  core/
    src/
      commands/
        grep/
          index.ts
          types.ts
          parseOptions.ts
          execute.ts
          formatResult.ts
        <command-name>/
          index.ts
          types.ts
          execute.ts
      shared/
        errors/
          userError.ts
        text/
          normalizeLineEndings.ts
    __tests__/
      commands/
        grep/
          execute.test.ts
          formatResult.test.ts
        <command-name>/
          execute.test.ts

  plugin/
    src/
      main.ts
      commands/
        index.ts
        types.ts
        grep/
          index.ts
          registerCliHandler.ts
          registerPaletteCommand.ts
          parseCliArgs.ts
          buildVaultSource.ts
        <command-name>/
          index.ts
          registerCliHandler.ts
          registerPaletteCommand.ts
          parseCliArgs.ts
      shared/
        vault/
          listCommandTargetFiles.ts
          readVaultTextFile.ts
        ui/
          showErrorNotice.ts
```

## 役割分担

### `packages/core/src/commands/<command-name>/`

その command の純粋ロジックを置く。

- オプションの正規化
- 入力値検証
- 実処理
- 出力整形
- 型定義

`parseOptions.ts` を置く場合は、typed な入力を domain option に正規化し、実行可能な形まで検証する責務を持たせる。

ここでは `obsidian` を import しない。
unit test もここを中心に書く。

### `packages/plugin/src/commands/<command-name>/`

その command の Obsidian 側 adapter を置く。

- CLI handler 登録
- command palette 登録
- CLI 引数の解釈
- vault からのデータ取得
- `core` の呼び出し
- Obsidian 向けエラー表示

command ごとにディレクトリを分けることで、実装者は自分の command 配下だけを見ればよくなる。

`parseCliArgs.ts` を置く場合は、`CliData` のような Obsidian 依存の生データを typed な入力へ変換する責務だけを持たせる。
CLI 固有の癖はここで吸収し、domain validation は `core` 側で行う。

### `packages/plugin/src/commands/index.ts`

全 command の registry だけを持つ。

例:

```ts
import type { Plugin } from "obsidian";
import { registerGrepCommand } from "./grep";
import { registerSearchCommand } from "./search";

export function registerCommands(plugin: Plugin): void {
	registerGrepCommand(plugin);
	registerSearchCommand(plugin);
}
```

このファイルは新 command 追加時にだけ更新する。
競合は起こりうるが、変更範囲は最小で済む。

## 並列開発しやすくするための単位

1 つの command を追加・変更するときに、基本的に触るファイルは次に限定する。

- `packages/core/src/commands/<command-name>/...`
- `packages/core/__tests__/commands/<command-name>/...`
- `packages/plugin/src/commands/<command-name>/...`
- `docs/design/<command-name>.md`
- `packages/plugin/src/commands/index.ts`

この形にすると、複数人が別 command を実装しても競合箇所は registry だけになる。

## command ディレクトリの責務テンプレート

各 command は最低限次の構成を持つ。

```text
packages/core/src/commands/<command-name>/
  index.ts
  types.ts
  execute.ts

packages/plugin/src/commands/<command-name>/
  index.ts
  registerCliHandler.ts
  parseCliArgs.ts
```

必要なら次を追加する。

- `registerPaletteCommand.ts`
- `buildVaultSource.ts`
- `formatCliOutput.ts`
- `schema.ts`

command 固有のファイル名を揃えることで、別 command を触る人も構成をすぐ読める。

`buildVaultSource.ts` は完全な必須ではないが、vault を読む command では原則として用意する。
vault 読み出しを `registerCliHandler.ts` に直接書かないための分離ポイントとして扱う。

## parseCliArgs と parseOptions の境界

この 2 つは責務を明確に分ける。

- `packages/plugin/src/commands/<command-name>/parseCliArgs.ts`
  - `CliData` などの Obsidian 依存入力を受ける
  - string / boolean / null の揺れを吸収する
  - plugin 内部で使う typed input を返す
- `packages/core/src/commands/<command-name>/parseOptions.ts`
  - typed input を domain option に変換する
  - 必須値や組み合わせ制約を検証する
  - 実行時に使う正規化済み option を返す

例:

- `parseCliArgs.ts`: `params.name === "true"` のような CLI 固有の癖を処理する
- `parseOptions.ts`: `--files-with-matches` と `--count` の同時指定を弾く

この分離により、CLI 以外の入口を追加しても `core` を再利用しやすい。

## エラー契約

error flow も command ごとに共通化する。

- `core` は user-facing な入力不正を `UserError` として throw する
- `plugin` は `UserError` を catch して CLI 向けメッセージや Notice に変換する
- 想定外エラーは握りつぶさず、plugin 側で最低限の文脈を付けて失敗として返す

`shared/errors/userError.ts` はこの契約のために置く。
validation の責務が `core` にあり、表示の責務が `plugin` にあることを崩さない。

## 実装フロー

新 command を追加するときの流れは次のとおり。

1. `docs/design/<command-name>.md` に仕様を書く
2. `packages/core/src/commands/<command-name>/` に純粋ロジックを作る
3. `packages/core/__tests__/commands/<command-name>/` に test を作る
4. `packages/plugin/src/commands/<command-name>/` に Obsidian adapter を作る
5. `packages/plugin/src/commands/index.ts` に登録する

この順序にすると、仕様と core を先に固めてから plugin 側を薄く保てる。
`docs/` 配下も command 単位に揃えておくことで、実装と仕様の対応が追いやすくなる。

## 命名ルール

- directory 名は CLI command 名と揃える
- command ID は stable に保つ
- `registerCliHandler.ts` は CLI 用
- `registerPaletteCommand.ts` は Obsidian command palette 用
- `buildVaultSource.ts` は vault 依存データ取得用
- `execute.ts` は core の実処理

`command ID` は `plugin.addCommand({ id })` に渡す文字列を指す。
これを変更すると既存ユーザーの keybinding や workflow が壊れるので、release 後は rename しない。

例:

- command 名: `grep`
- core: `packages/core/src/commands/grep/`
- plugin: `packages/plugin/src/commands/grep/`
- doc: `docs/design/grep.md`

## この構造にする理由

- `main.ts` が肥大化しない
- command 単位でレビューしやすい
- command ごとの test 配置が明確になる
- 将来 command 数が増えても整理しやすい
- 「core の責務」と「plugin の責務」が command 単位で対応する

特にこの plugin は CLI 拡張が主目的なので、レイヤ単位よりも command 単位の切り方の方が開発体験に合う。

## 現在の repository からの移行方針

現状はまだ最小構成なので、次のように段階移行するのがよい。

### Step 1

- `packages/plugin/src/commands/registerCommands.ts` を `packages/plugin/src/commands/index.ts` に寄せる
- `packages/plugin/src/cli/registerCliHandlers.ts` を command 単位へ分解する
- Step 1 完了後は `packages/plugin/src/cli/` ディレクトリを廃止する

### Step 2

- 最初の実 command として `grep` などを `packages/core/src/commands/grep/` と `packages/plugin/src/commands/grep/` に作る

### Step 3

- 共通化が必要になったら `shared/` へ移す
- 先に `shared/` を作り込みすぎない

## 避けるべき構成

- すべての CLI handler を 1 ファイルに集約する
- すべての command palette command を 1 ファイルに集約する
- `core` に Obsidian API を持ち込む
- 先に巨大な共通 abstraction を作る

特に `registerCliHandlers.ts` が肥大化すると、command ごとの並列開発がすぐ難しくなる。

## 結論

この repository では、`command` を最上位の実装単位にした構成を採るのがよい。

- pure logic: `packages/core/src/commands/<command-name>/`
- Obsidian adapter: `packages/plugin/src/commands/<command-name>/`
- spec: `docs/design/<command-name>.md`
- registry: `packages/plugin/src/commands/index.ts`

この形なら、各 command をほぼ独立して実装・レビュー・テストできる。
