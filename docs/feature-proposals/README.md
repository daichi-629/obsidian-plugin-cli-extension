# Feature Proposals

`docs/feature-proposals/` は、未実装 proposal と既に実装された foundation を同じ階層に混在させないように整理している。

- `foundations/`:
  既に利用可能な CLI foundation。`grep`, `apply-patch`, `render-template`, `schema`, `traverse` をここで基準化する。
- `analysis/`:
  vault 解析と安全確認の proposal。`audit`, `delta`, `impact`。
- `context/`:
  note 収集、embed 展開、narrative packaging の proposal。
- `editing/`:
  `excli-apply-patch` の上位に載る mutation proposal。
- `link-intelligence/`:
  link ranking / discovery 系 proposal。
- `research/`:
  claims, evidence, inbox, tension など knowledge workflow proposal。
- `integrated/`:
  複数 proposal を横断する shared foundation の設計ノート。

実装済み foundation の確認結果は [foundations/README.md](/home/daichi/ghq/github.com/daichi-629/obsidian-plugin-cli-extension/docs/feature-proposals/foundations/README.md) に寄せる。

`priority_rank` は pending proposal の優先順を表す。実装済み foundation は backlog から外し、`priority_rank: 0` とする。
