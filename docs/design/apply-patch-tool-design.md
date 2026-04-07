# Apply patch tool design

## 目的

Codex が使う `apply_patch` tool の patch 形式を、この repository の設計知識として整理する。

- 標準 unified diff ではなく Codex 独自の `Apply_patch` 形式を前提にする
- Lark grammar と実装の差分を含めて、利用時の判断材料を残す
- LLM に patch を生成させる際の安定した書式を明文化する

この文書は `apply_patch` tool の入出力設計を対象とし、Git patch 互換を目指さない。

## 前提

- grammar の source of truth は [`tool_apply_patch.lark`](/home/daichi/ghq/github.com/openai/codex/codex-rs/core/src/tools/handlers/tool_apply_patch.lark#L1)
- tool prompt 上の制約には「相対パスのみ」「Add File の本文はすべて `+`」が含まれる
- parser 実装は spec より少し lenient で、marker 周辺の空白や heredoc 付き誤出力を一部許容する
- patch 適用は行番号ベースではなく、`@@` と文脈行の一致探索で行う

## 非目標

- GNU `patch` や unified diff の一般解説
- Git index や rename detection の再現
- front matter を patch の外側に持つ独自 wrapper の導入

front matter はこの形式の一部ではない。安定性のため、生成する patch 本文に front matter を含めない。

## 全体構造

patch 全体は次の envelope を持つ。

```text
*** Begin Patch
[ one or more file hunks ]
*** End Patch
```

Lark grammar では次のように定義される。

```lark
start: begin_patch hunk+ end_patch
begin_patch: "*** Begin Patch" LF
end_patch: "*** End Patch" LF?
```

重要な点:

- `*** Begin Patch` で開始する
- file hunk は 1 個以上必須
- `*** End Patch` で終了する
- 終端の改行は省略できる

## ファイル操作モデル

1 つの file hunk は `追加`, `削除`, `更新` のいずれかである。

```lark
hunk: add_hunk | delete_hunk | update_hunk
```

### Add File

```lark
add_hunk: "*** Add File: " filename LF add_line+
add_line: "+" /(.*)/ LF
```

- 新規ファイル作成を表す
- header の後は 1 行以上の本文が必要
- 本文はすべて `+` で始める

例:

```text
*** Add File: hello.txt
+hello
+world
```

### Delete File

```lark
delete_hunk: "*** Delete File: " filename LF
```

- 既存ファイル削除を表す
- header のみで本文は持たない

例:

```text
*** Delete File: old.txt
```

### Update File

```lark
update_hunk: "*** Update File: " filename LF change_move? change?
change_move: "*** Move to: " filename LF
```

- 既存ファイルの更新を表す
- `*** Move to:` による rename を直後に 1 回だけ置ける
- grammar 上は `change?` で空 update を書ける
- command 設計上は `Move to` を伴う場合に限り rename-only update として許可する
- `Move to` を伴わない空 update は実装側でエラー扱い

例:

```text
*** Update File: src/app.rs
*** Move to: src/main.rs
@@
-old
+new
```

## パス制約

```lark
filename: /(.+)/
```

grammar 上は任意文字列だが、tool prompt と実装上の期待値は相対パスである。

- patch 中の file path は相対パスのみ
- 絶対パスは使わない
- rename 時の `Move to` 先も相対パスのみ

これは `apply_patch` を workdir 基準で安全に適用するための制約である。

## 変更本文の構造

更新 hunk の変更本文は `@@` 行と差分行から構成される。

```lark
change: (change_context | change_line)+ eof_line?
change_context: ("@@" | "@@ " /(.+)/) LF
change_line: ("+" | "-" | " ") /(.*)/ LF
eof_line: "*** End of File" LF
```

### `@@` 行

- `@@` 単体、または `@@ class Foo` のような header 付き形式を取る
- 実装上は行番号指定ではなく、変更位置を探すための文脈 anchor として使われる
- 必要なら複数の `@@` 行を使って探索位置を絞り込める

例:

```text
@@ class BaseClass
@@ def method():
 old
-before
+after
 tail
```

### 差分行

- `+` は追加
- `-` は削除
- 先頭スペースは文脈保持

この形式では unified diff の `@@ -1,3 +1,4 @@` のような行番号情報は使わない。

### EOF marker

- `*** End of File` はファイル末尾に対する変更を補助する marker
- `is_end_of_file` として内部表現に反映される

## 適用アルゴリズムの要点

適用時は line number を信用せず、文脈探索で置換位置を決める。

- `@@` の文脈行があれば、その行を元ファイルから探索する
- 続いて `old_lines` の並びを探索し、見つかった区間を `new_lines` に置換する
- `old_lines` が空なら追加として扱う
- `*** End of File` がある場合は末尾一致を優先する

参照: [`lib.rs`](/home/daichi/ghq/github.com/openai/codex/codex-rs/apply-patch/src/lib.rs#L386)

このため、安定した patch を作るには「一意に特定できる文脈」を含めることが重要になる。

## parser 実装の補足

parser は grammar をそのまま厳格適用するだけではなく、誤生成に少し耐える。

- patch marker 周辺の前後空白を許容する
- `<<'EOF' ... EOF` のような heredoc 付き誤出力を lenient mode で吸収する
- ただし最終的には `*** Begin Patch` / `*** End Patch` を持つ本文に正規化される必要がある

参照:

- [`parser.rs`](/home/daichi/ghq/github.com/openai/codex/codex-rs/apply-patch/src/parser.rs#L23)
- [`parser.rs`](/home/daichi/ghq/github.com/openai/codex/codex-rs/apply-patch/src/parser.rs#L119)

この lenient 挙動は fallback であり、生成側は常に strict に通る patch を出すべきである。

## 生成ルール

LLM が patch を生成する際は次を守る。

- patch 全体を `*** Begin Patch` と `*** End Patch` で囲む
- file operation ごとに必ず `Add File` / `Delete File` / `Update File` header を置く
- `Add File` の本文は全行 `+` を付ける
- file path は相対パスのみを使う
- 変更箇所の前後には原則 3 行程度の文脈を付ける
- 3 行で一意に決まらない場合は `@@ class ...` や `@@ def ...` を追加する
- 近接した変更では文脈の重複を避ける
- front matter は patch 本文に含めない

## 推奨例

```text
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch
```

## 注意点

- これは Git diff ではないので、`diff --git` や `index` 行は不要
- `Update File` は rename と内容変更を同じ hunk で表現できる
- rename-only を除き、空 update は実装に通らない前提で扱う
- parser が lenient でも、それを前提にした出力は避ける

## 参照

- [`tool_apply_patch.lark`](/home/daichi/ghq/github.com/openai/codex/codex-rs/core/src/tools/handlers/tool_apply_patch.lark#L1)
- [`apply_patch.rs`](/home/daichi/ghq/github.com/openai/codex/codex-rs/core/src/tools/handlers/apply_patch.rs#L449)
- [`parser.rs`](/home/daichi/ghq/github.com/openai/codex/codex-rs/apply-patch/src/parser.rs#L23)
- [`lib.rs`](/home/daichi/ghq/github.com/openai/codex/codex-rs/apply-patch/src/lib.rs#L386)
