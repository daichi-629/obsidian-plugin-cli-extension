# Traverse command design

## 目的

Obsidian CLI 拡張として `traverse` command 群を追加し、vault の note link graph に対して決定論的な探索を行えるようにする。

この設計は [`traverse` proposal](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/feature-proposals/traverse.md) を具体化したものであり、[`context-engine`](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/feature-proposals/integrated/context-engine.md) の下位基盤として再利用できる graph primitive を先に固めることを目的とする。

狙いは次の 5 点。

- note 間リンクを 1-hop の列挙ではなく graph として探索できるようにする
- shortest path、depth-limited reachability、cluster detection を CLI から安定して実行できるようにする
- `context`, `disambiguate`, `serendipity`, `audit` が再利用できる graph snapshot と traversal API を先に定義する
- graph algorithm 本体は `packages/core` に置き、Obsidian 依存は `packages/plugin` に閉じ込める
- `main.ts` に command registration 以上の責務を持ち込まない

## Summary

`traverse` は 1 つの多機能 command ではなく、mode ごとに別 command として公開する。

- `excli-traverse:reach`
    - 1 つの seed note から depth 制限付きで到達可能な note と edge を返す
- `excli-traverse:path`
    - 2 note 間の shortest path を返す
- `excli-traverse:clusters`
    - scope 内 note の weakly connected component を返す

feature proposal では `shortest-path` や `clusters` を flag で切り替える形だったが、詳細設計では mode ごとに command を分離する。
理由は次のとおり。

- required option が mode ごとに大きく異なる
- output shape も mode ごとに大きく異なる
- `schema` command 群と同じ `excli-<name>:<mode>` 規約に揃えた方が `spec.ts` と CLI help を保守しやすい
- mode ごとの validation error を簡潔にできる

### Goals

- markdown note を node、resolved internal link を directed edge とする graph snapshot を作れる
- `reach` で seed note から depth hop 以内の note 群と subgraph を返せる
- `path` で unweighted shortest path を決定論的に返せる
- `clusters` で scope 内の weakly connected component を列挙できる
- `folder` / `tag` filter で対象 subgraph を絞れる
- note 指定に vault-relative path と linkpath を使える
- formatter が text / json / tsv の安定出力を返せる
- BFS / component detection と formatter を `packages/core` で unit test できる
- graph snapshot を `context-engine` 系 command が再利用できる API にする

### Non-goals

- weighted graph や importance scoring
- semantic similarity や embed/content relevance を考慮した ranking
- unresolved link を graph node として仮想的に扱うこと
- heading / block 単位の traversal
- graph visualization UI
- SCC strongly connected components や PageRank のような高度な graph analytics
- file body を都度 parse し直して link kind ごとの差分を出すこと
- graph snapshot の永続化や index file の保存
- wildcard path / saved search / stdin を入力ソースにすること

## 仕様設計

### Command shape

公開 command は次の 3 つとする。

```text
obsidian excli-traverse:reach from=<path-or-linkpath> [depth=<n>] [direction=<out|in|both>] [folder=<path>] [tag=<tag>] [format=<text|json|tsv>]
obsidian excli-traverse:path from=<path-or-linkpath> to=<path-or-linkpath> [direction=<out|both>] [folder=<path>] [tag=<tag>] [format=<text|json|tsv>]
obsidian excli-traverse:clusters [folder=<path>] [tag=<tag>] [min-size=<n>] [format=<text|json|tsv>]
```

`path-or-linkpath` は vault-relative path または Obsidian の internal link 名を指す。
例: `projects/atlas.md`, `projects/atlas`, `Atlas`

共通 option ルール:

- `folder` / `tag` は単一値のみ受け付ける
- `folder` と `tag` は scope を作る filter であり、結果整形後の post-filter ではない
- `format` は `text` を default とする
- `spec.ts` は `schema` command 群と同様に、CLI flag metadata、manual/help 出力、notes の source of truth とする

### Naming

- directory 名: `traverse`
- plugin command ID:
    - `traverse:reach`
    - `traverse:path`
    - `traverse:clusters`
- CLI 名:
    - `excli-traverse:reach`
    - `excli-traverse:path`
    - `excli-traverse:clusters`

`excli-traverse` 単体 command は登録しない。

### Scope selection model

`folder` / `tag` はすべての mode で「探索対象となる subgraph」を決める filter とする。
v1 ではどちらも単一値のみ受け付け、複数 `folder` や複数 `tag` の OR 条件はサポートしない。

- `folder=<path>`
    - vault-relative folder prefix
    - `notes` と `notes/` は同じ prefix に正規化する
- `tag=<tag>`
    - leading `#` を除去して比較する
    - note が 1 つでもその tag を持てば含める
- `folder` と `tag` を同時指定した場合は AND 条件

scope filter は node に対して適用し、その後 edge は `from` と `to` の両端が scope 内にあるものだけ残す。

`scope.noteCount` / `scope.edgeCount` は、常にこの folder/tag 適用後かつ mode 実行前の subgraph 全体を指す。
mode 実行後の結果件数が別に必要な場合だけ、各 result contract 側で追加フィールドを持つ。

### Mode-specific implications

- `reach`
    - `from` は scope 内 node でなければ error
- `path`
    - `from` と `to` の両方が scope 内 node でなければ error
    - shortest path は scope 内 subgraph だけを探索する
- `clusters`
    - scope 内 subgraph 全体の weak component を返す

この定義により、`path` は「project folder 内だけを通る経路」のような制約付き探索に使える。

### Direction semantics

`direction` は `reach` と `path` にのみ適用する。

- `out`
    - note から note への通常リンク方向に進む
- `in`
    - backlink 方向に進む
- `both`
    - directed graph を undirected projection として扱う

default は `out` とする。

`path` では `direction=in` を受け付けない。
`path from=A to=B direction=in` は `path from=B to=A direction=out` と等価で command surface だけを増やすため、v1 では `path` の direction を `out|both` に絞る。

`clusters` は direction を受け取らず、常に undirected projection 上の weakly connected component を返す。
cluster detection の目的は「孤立したまとまり」の検出であり、link direction を保持すると user expectation とずれやすいためである。

### Output conventions

- TSV は全 mode で node-centric row format に統一し、edge は返さない
- edge を含む richer な graph shape が必要な consumer は JSON を使う
- text は人間向け summary を優先し、詳細構造は JSON/TSV に寄せる
- `name` は basename の表示補助であり、識別子としては常に `path` を使う

### Reach design

#### Purpose

`excli-traverse:reach` は seed note 周辺の neighborhood を返す low-level traversal command である。
`context` の関連 note 収集や `serendipity` の graph-distance feature の基盤になる。

#### Option semantics

- `from=<path-or-linkpath>`
    - seed note
    - required
- `depth=<n>`
    - non-negative integer
    - default `2`
- `direction=<out|in|both>`
    - default `out`
- `folder=<path>`
    - optional subgraph filter
- `tag=<tag>`
    - optional subgraph filter
- `format=<text|json|tsv>`
    - default `text`

#### Algorithm

- breadth-first search を使う
- queue へ積む隣接 node は path 昇順に並べる
- 既訪問判定は node path 単位
- `depth=0` は seed note のみ返す

返す edge は「結果集合に含まれる node 同士を結ぶ scope 内 edge 全件」とする。
単なる BFS tree ではなく induced subgraph を返すことで、後段 consumer が局所構造を再利用しやすくする。

#### Reach JSON contract

```ts
type TraverseReachResult = {
	mode: "reach";
	scope: {
		from: string;
		folder: string | null;
		tag: string | null;
		direction: "out" | "in" | "both";
		depth: number;
		// folder/tag を適用した探索前 subgraph 全体の件数
		noteCount: number;
		edgeCount: number;
	};
	result: {
		// BFS 結果として返す node 群と induced subgraph edge 群の件数
		noteCount: number;
		edgeCount: number;
	};
	nodes: Array<{
		path: string;
		name: string;
		hops: number;
	}>;
	edges: Array<{
		from: string;
		to: string;
		linkCount: number;
	}>;
};
```

`nodes` は `hops`, `path` 昇順で安定化する。
`edges` は `from`, `to` 昇順で安定化する。
JSON consumer が結果件数を見たい場合は `result.noteCount` / `result.edgeCount` を使う。

#### Reach text output

```text
Seed: projects/project-x.md
Direction: out
Depth: 2
Nodes: 3
Edges: 2

0  projects/project-x.md
1  projects/requirements.md
2  reference/ml-basics.md
```

text では edge 一覧は既定では出さず summary と node list を返す。
edge が必要な consumer は `format=json` を使う。

#### Reach TSV contract

```tsv
hops	path	name
0	projects/project-x.md	project-x
1	projects/requirements.md	requirements
2	reference/ml-basics.md	ml-basics
```

automation で edge も必要な場合は JSON を使う前提とする。

### Shortest path design

#### Purpose

`excli-traverse:path` は 2 note 間の shortest path を返す。
`disambiguate` の context distance、`context` の seed 間接続確認に再利用する。

#### Option semantics

- `from=<path-or-linkpath>`
    - start note
    - required
- `to=<path-or-linkpath>`
    - target note
    - required
- `direction=<out|both>`
    - default `out`
- `folder=<path>`
    - optional subgraph filter
- `tag=<tag>`
    - optional subgraph filter
- `format=<text|json|tsv>`
    - default `text`

#### Algorithm

- unweighted BFS を使う
- adjacency は path 昇順で探索する
- 最初に見つかった path を返す
- `from` と `to` が同じ note に解決された場合は、`hops=0`、単一 node、edge なしの成功 result を返す

この tie-break により、同 hop 数の複数 shortest path がある場合でも結果が安定する。
v1 では「全 shortest paths を返す」ことはしない。

#### No-path behavior

経路が存在しない場合は command failure にはせず、空 result を返す。

- text: `No path found.`
- json: `found: false`
- tsv: header only

これは graph 上で path がないことを usage error ではなく正常系の問い合わせ結果とみなすためである。

#### Path JSON contract

```ts
type TraversePathResult =
	| {
			mode: "path";
			found: true;
			scope: {
				from: string;
				to: string;
				folder: string | null;
				tag: string | null;
				direction: "out" | "both";
				// folder/tag を適用した探索前 subgraph 全体の件数
				noteCount: number;
				edgeCount: number;
			};
			hops: number;
			nodes: Array<{
				index: number;
				path: string;
				name: string;
			}>;
			edges: Array<{
				from: string;
				to: string;
				linkCount: number;
			}>;
	  }
	| {
			mode: "path";
			found: false;
			scope: {
				from: string;
				to: string;
				folder: string | null;
				tag: string | null;
				direction: "out" | "both";
				noteCount: number;
				edgeCount: number;
			};
	  };
```

`found: true` の場合、`nodes[0].path` は `from`、最後の要素は `to` である。
`edges.length` は常に `nodes.length - 1`。

#### Path text output

```text
projects/pkm.md -> notes/note-management.md -> reference/ml.md
hops: 2
```

`direction=both` でも text formatter は path sequence を `->` で統一する。
方向性の詳細は summary line に保持し、可読性を優先する。

#### Path TSV contract

hop ごとに 1 row を返す。

```tsv
index	path	name
0	projects/pkm.md	pkm
1	notes/note-management.md	note-management
2	reference/ml.md	ml
```

### Cluster design

#### Purpose

`excli-traverse:clusters` は scope 内 graph の weakly connected component を列挙する。
`audit` の orphan / fragmented area 検出や `serendipity` の cluster-aware ranking の基盤になる。

#### Option semantics

- `folder=<path>`
    - optional subgraph filter
- `tag=<tag>`
    - optional subgraph filter
- `min-size=<n>`
    - positive integer
    - default `1`
- `format=<text|json|tsv>`
    - default `text`

`min-size=1` は singleton note cluster を含む。
`min-size=2` 以上にすると孤立 note を除いた cluster だけを見られる。

#### Algorithm

- scope 内 graph を undirected projection に変換する
- path 昇順 node order で component search を始める
- 各 component 内 node も path 昇順で返す
- component index は永続 ID ではなく、結果内の並び順に応じた 0-origin index

component の並び順は次で安定化する。

1. size 降順
2. 最小 path 昇順

#### Cluster JSON contract

```ts
type TraverseClustersResult = {
	mode: "clusters";
	scope: {
		folder: string | null;
		tag: string | null;
		noteCount: number;
		edgeCount: number;
		// min-size 適用前の weak component 総数
		componentCount: number;
		// min-size 適用後に clusters として返す件数
		displayedComponentCount: number;
		minSize: number;
	};
	clusters: Array<{
		index: number;
		size: number;
		paths: string[];
	}>;
};
```

#### Cluster text output

```text
Scope notes: 12
Scope edges: 18
Components (total): 5
Components (min-size >= 3): 2
Minimum size: 3

[0] size=5 first=areas/ml.md
[1] size=4 first=projects/atlas.md
```

text 出力は summary 主体にし、cluster 内全 path は出さない。
詳細が必要な場合は JSON か TSV を使う。

#### Cluster TSV contract

1 row 1 note とする。

```tsv
cluster_index	cluster_size	path	name
0	5	areas/ml.md	ml
0	5	areas/pkm.md	pkm
1	4	projects/atlas.md	atlas
```

### Input validation

#### Common

- unknown `excli-traverse:*` command は登録しない
- `folder` は vault-relative path prefix として正規化する
- `tag` は leading `#` を外してから空文字でないことを確認する
- `format` は mode ごとの許可値以外なら usage error
- `path-or-linkpath`、単一値 `folder` / `tag` 制約、大きな `depth` で結果が増える点は `spec.ts` の description/notes に明記する

#### Reach

- `from` 必須
- `depth` は整数かつ `0` 以上
- `direction` は `out|in|both`

#### Path

- `from`, `to` 必須
- `direction` は `out|both`

#### Clusters

- `min-size` は整数かつ `1` 以上
- `direction`, `from`, `to`, `depth` は usage error

### Error model

error は 3 類型に分ける。

- usage error
    - 不正 option、必須引数欠落、範囲外数値、mode 不一致 option
- resolution error
    - `from` / `to` が note に解決できない、または曖昧
- execution result
    - path が見つからないなど、問い合わせ自体は正常に完了したが結果が空

`path not found` を error にしないことが重要で、automation 側が「経路なし」を条件分岐しやすくする。
plugin CLI 境界では v1 は usage error と resolution error をともに `UserError` で表現し、handler 側で区別せず message を返す。
エラー類型の区別は設計上の説明責務であり、公開 error class を分ける必須要件ではない。

### Determinism rules

## 詳細設計

### Graph model

#### Node model

graph node は 1 markdown note を表し、node ID は vault-relative path とする。

```ts
type GraphNode = {
	path: string;
	name: string;
	folder: string;
	tags: string[];
};
```

`name` は表示用の basename、`path` が canonical ID である。
graph algorithm は常に `path` ベースで動き、basename だけでは識別しない。

#### Edge model

graph edge は resolved internal link を正規化した directed edge とする。

```ts
type GraphEdge = {
	from: string;
	to: string;
	linkCount: number;
};
```

初版では edge weight を shortest path に使わないが、`linkCount` は将来の ranking や diagnostic に使えるので保持する。

同一 source note から同一 target note への複数 link は 1 edge に collapse し、`linkCount` に集約する。

#### Snapshot contract

```ts
type GraphSnapshot = {
	nodes: GraphNode[];
	edges: GraphEdge[];
	outgoing: Record<string, GraphEdge[]>;
	incoming: Record<string, GraphEdge[]>;
	meta: {
		noteCount: number;
		edgeCount: number;
	};
};
```

`outgoing` と `incoming` は BFS を安定化するため path 昇順で保持する。

### Vault graph collection

#### Source of truth

plugin 側では Obsidian の metadata を使って graph snapshot を構築する。

- node source: `app.vault.getMarkdownFiles()`
- edge source: `app.metadataCache.resolvedLinks`
- tag source: 各 file の `CachedMetadata.tags` と frontmatter tags

file 内容を直接再 parse して link graph を作ることはしない。
CLI command は vault state の即時反映よりも決定論性と速度を優先し、Obsidian が保持している metadata cache を source of truth とする。

#### Inclusion rules

- `.md` file のみ node に含める
- `.obsidian/` 配下は常に除外する
- attachment や canvas は node に含めない
- resolved link の target が markdown note でない場合は edge に含めない
- self-loop は graph から除外する
- unresolved link は graph edge に含めない

#### Path normalization

- node ID は常に vault-relative path with `.md`
- folder は親 directory の vault-relative path。vault root 直下は `""`
- tag は leading `#` を除去して保持する
- path sort は locale 依存を避けて codepoint 順の単純比較に固定する

### Operand resolution

`from` と `to` は `path-or-linkpath` として受け取り、plugin 側で canonical note path に解決する。

#### Resolution order

1. exact vault-relative path match
2. `.md` を省略した exact path match
3. unique linkpath match
4. unique basename match

複数候補に解決される場合は自動で選ばず error にする。

```text
Ambiguous note operand: "PKM"
Candidates:
- notes/PKM.md
- reference/PKM.md
```

この挙動により、CLI automation では path を使えば決定論的であり、対話的な利用では unique basename も使える。

### Proposed structure

`traverse` は command 層と reusable graph 基盤を分ける。

```text
docs/
  design/
    traverse-command-design.md

packages/
  core/
    src/
      graph/
        types.ts
        buildGraphSnapshot.ts
        filterGraphScope.ts
        shortestPath.ts
        reachability.ts
        findWeakComponents.ts
      commands/
        traverse/
          index.ts
          types.ts
          executeReach.ts
          executePath.ts
          executeClusters.ts
          formatReach.ts
          formatPath.ts
          formatClusters.ts
    __tests__/
      graph/
        shortestPath.test.ts
        reachability.test.ts
        findWeakComponents.test.ts
      commands/
        traverse/
          formatReach.test.ts
          formatPath.test.ts
          formatClusters.test.ts

  plugin/
    src/
      graph/
        collectVaultGraphSnapshot.ts
        resolveGraphOperand.ts
      commands/
        traverse/
          index.ts
          types.ts
          spec.ts
          parseCliArgs.ts
          registerCliHandler.ts
```

`packages/core/src/graph/` は command 非依存の共有基盤とし、`context`, `disambiguate`, `serendipity`, `audit` が later phase で import できる場所に置く。

- `buildGraphSnapshot.ts`
    - node/edge 配列から `outgoing` / `incoming` adjacency を持つ `GraphSnapshot` を組み立てる factory
- `filterGraphScope.ts`
    - 既存 `GraphSnapshot` に `folder` / `tag` filter を適用し、scope 済み subgraph を返す純粋関数

graph 系 command は同じ vault metadata に対して同じ出力を返すことを優先する。

- node order は常に path 昇順
- adjacency traversal order も path 昇順
- shortest path tie は BFS + sorted adjacency で安定化
- component order は size 降順、tie は最小 path 昇順
- JSON formatter は object key 順を実装依存にしないよう、array の順序を固定する

### Responsibilities

#### `packages/core/src/graph/`

Obsidian 非依存の graph primitive を置く。

- graph 型定義
- node/edge 配列から adjacency を組み立てる
- scope filter を適用して subgraph を返す
- scope 済み snapshot に対する BFS reachability
- shortest path
- weak component detection

ここでは vault path 解決や `MetadataCache` には触れない。

#### `packages/core/src/commands/traverse/`

traverse command 向け orchestration と formatter を置く。

- typed input から core graph API を呼ぶ
- reach/path/clusters の result shape を構築する
- text/json/tsv formatter
- mode ごとの stable sorting

#### `packages/plugin/src/graph/`

Obsidian adapter としての graph source を置く。

- markdown file 列挙
- `MetadataCache.resolvedLinks` から edge を集計
- tag 収集
- `from` / `to` operand の解決

`collectVaultGraphSnapshot.ts` は `MetadataCache.resolvedLinks` と markdown file metadata だけを参照して同期的に snapshot を組み立てる。
`vault.cachedRead` は不要なので、`registerCliHandler` 側も graph collection のためだけに `await` を要求しない。

#### `packages/plugin/src/commands/traverse/`

CLI surface を置く。

- raw `CliData` の parse
- usage error の生成
- core execute API の呼び出し
- `spec.ts` に基づく manual output
- 3 command の registration

### Reuse boundary

graph algorithm は `commands/traverse` の private helper に閉じず、`packages/core/src/graph/` に置く。
これにより `context`, `disambiguate`, `serendipity`, `audit` から `reachability`, `shortestPath`, `findWeakComponents` を直接再利用できる。

### Performance expectations

v1 は plugin session 全体で永続 cache を持たず、command invocation ごとに metadata から snapshot を組み立てる。

理由:

- `MetadataCache.resolvedLinks` を使えば file body の再読み込みなしで構築できる
- `main.ts` の startup を重くしない
- CLI command 実行時に最新 metadata を読む方が単純で安全

snapshot 構築自体は metadata 参照だけなので比較的軽いが、`reach depth=N` の出力件数は graph の branching factor に応じて急増しうる。
特に large vault で大きい `depth` を指定すると BFS 結果と induced subgraph が大きくなるため、v1 は truncation を入れず full result を返す前提で扱う。

将来 `context-engine` 群で repeated traversal が問題になった場合のみ、plugin 側に memoized `VaultGraphProvider` を導入する。
その場合も cache の invalidation は metadata change event 起点に限定し、`packages/core` の API は変えない。

### Testing strategy

#### Core tests

- shortest path が最短 hop を返す
- 同 hop の複数 path があるとき lexicographically stable な 1 本を返す
- `direction=in|both` が正しく機能する
- `depth=0`, `depth=1` の境界
- `filterGraphScope` が `folder` / `tag` で正しく subgraph を縮退する
- cluster detection が singleton と multi-node cluster を正しく分ける
- `min-size` filter 後の cluster order が安定する

#### Plugin tests

- `resolvedLinks` から duplicate edge を collapse できる
- non-markdown target を除外できる
- operand resolution が path / basename / ambiguous case を正しく扱う
- `spec.ts` の option と parse 実装が一致する

#### Manual verification

runtime behavior を変える command 追加なので、最終実装時は `pnpm run build` に加えて development vault 上の確認を行う。

想定確認項目:

- `excli-traverse:path` で既知の shortest path が返る
- `excli-traverse:reach depth=2` で 2-hop neighborhood が期待どおり返る
- `excli-traverse:clusters min-size=2` で小さな isolated area が返る
- rename 後の canonical path に対して operand resolution が破綻しない

### Open decisions deferred from v1

次は意図的に v1 から外す。

- unresolved link を仮想 node として含める graph mode
- `clusters` で strong component と weak component を切り替える option
- edge formatter を TSV にも載せる multi-table 出力
- link kind 別の filtering
- shortest path の全候補列挙
- multi-seed reach

これらは需要が出た時点で別 proposal として切り出した方が、初版の command surface を保ちやすい。
