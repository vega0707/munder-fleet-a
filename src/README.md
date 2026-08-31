# `src/` — Munder ↔ Core 适配 + Fleet 语义（Strategy A）

本目录是 **自研胶水**，不是 Multica 源码拷贝。

| 路径 | 职责 |
|------|------|
| `types.ts` | Runtime / Project / Task / PendingDecision / ExecutionLog / MichaelInbox |
| `fleet/store.ts` | SQLite 或内存；自动 `runtime:local`；DecisionGate；claim 并发上限 |
| `fleet/worker.ts` | claim → 真实 subprocess → complete → Michael |
| `fleet/server.ts` | HTTP；loopback 冻结 / Web（优先 Core JWT）；静态壳 |
| `fleet/cli.ts` | `npm run fleet` |

壳 UI：`../shell/`（品牌 **Munder**）。Overlay：`../overlays/aioncore-fleet/`。

```bash
npm test
npm run fleet                 # http://127.0.0.1:3847
npm run fleet -- --mode web --core-base http://127.0.0.1:25808
npm run demo                  # claim→work→complete
npm run demo:full             # + persist + peer runtime + hive
npm run verify:core
npm run overlay:core          # 把 migration 拷进 refs/AionCore
```
