# `src/` — Munder ↔ Core 适配 + Fleet 语义（Strategy A）

本目录是 **自研胶水**，不是 Multica 源码拷贝。

| 路径 | 职责 |
|------|------|
| `types.ts` | `Runtime` / `Project` / `Task(assignee)` / `PendingDecision` |
| `fleet/store.ts` | 单节点内存 store：自动 `runtime:local`、claim、complete→michael |
| `fleet/server.ts` | HTTP：loopback 免登 / Web cookie 登录；静态壳 |
| `fleet/cli.ts` | `npm run fleet` 入口 |

壳 UI：`../shell/`（品牌 **Munder**）。

```bash
npm test
npm run fleet          # http://127.0.0.1:3847  loopback
npm run fleet -- --mode web
npm run demo           # claim→complete DoD
npm run verify:core    # AionCore health + JWT（需先 bootstrap + build）
```
