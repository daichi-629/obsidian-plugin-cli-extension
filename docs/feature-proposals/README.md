# Feature Proposals

`docs/feature-proposals/` は、proposal のステータスごとにディレクトリを分けて管理する。

- `implement/`:
  実装済みの proposal。`schema`, `traverse` など shipped foundation と、grep / apply-patch / render-template の確認記録を含む。
- `archives/`:
  実装しないと決定した proposal、または設計変更で陳腐化した統合提案。
- `analysis/`:
  vault 解析と安全確認の proposal。`audit`, `impact`, `graph-hubs`, `tasks-query`。
- `context/`:
  note 収集・bulk read・narrative packaging の proposal。
- `editing/`:
  `excli-apply-patch` の上位に載る mutation proposal。`property-bulk-set` を含む。
- `link-intelligence/`:
  link ranking / discovery 系 proposal。
- `research/`:
  claims, evidence, tension など knowledge workflow proposal。
- `integrated/`:
  複数 proposal を横断する shared foundation の設計ノート。

`priority_rank` は pending proposal の優先順を表す。

## Feature Proposal List

current backlog を `priority_rank` 順に並べる。

1. [context/read-bulk.md](context/read-bulk.md): multi-note fetch の stage 0
2. [integrated/change-analysis.md](integrated/change-analysis.md): mutation preflight の canonical surface
3. [editing/block.md](editing/block.md): block-level read/write primitive
4. [link-intelligence/disambiguate.md](link-intelligence/disambiguate.md): link target ranking
5. [analysis/graph-hubs.md](analysis/graph-hubs.md): graph centrality analytics
6. [editing/property-bulk-set.md](editing/property-bulk-set.md): schema-aware bulk maintenance
7. [analysis/tasks-query.md](analysis/tasks-query.md): structured task query
8. [analysis/audit.md](analysis/audit.md): vault health report
9. [editing/workset.md](editing/workset.md): round-trip multi-file editing
10. [editing/refactor.md](editing/refactor.md): graph-aware restructuring
11. [research/claims.md](research/claims.md): claim-analysis の canonical surface
12. [research/evidence.md](research/evidence.md): `claims` の source proposal
13. [research/tension.md](research/tension.md): `claims` の source proposal
14. [context/narrative.md](context/narrative.md): time-ordered packaging
15. [link-intelligence/serendipity.md](link-intelligence/serendipity.md): exploratory link suggestion
16. [analysis/impact.md](analysis/impact.md): `change-analysis` の source proposal
17. [integrated/analysis-foundation.md](integrated/analysis-foundation.md): shared analyzer design
