# ROADMAP — Strategy A

> 本仓 monorepo：`shell/` + `src/fleet` + **`core/`（AionCore）**。A/B/C/D 最终表现应对齐。

## P0 — Core 立住 + 单节点 Fleet

- [x] AionCore 钉版本并收入 `core/`；健康检查与 JWT（`docs/VERSIONS.md` · `npm run verify:core`）
- [x] 扩展最小 Fleet 表/类型：Runtime、PendingDecision（TS + overlay migration in `core/`）
- [x] 本机自动 register runtime（`runtime:local`）
- [x] Munder/最小壳：Web 登录 / loopback 免登、任务与待定列表
- [x] DoD：claim→subprocess 干活→回传 Michael（`npm run demo`）
- [ ] Rust `/api/fleet/*` 在 `core/` 内落地（对齐 `src/fleet`；migration 已就位）

## P1 — Team 协作（Aion）

- [x] Michael inbox / DecisionGate / loopback 冻结（TS 面）
- [ ] Team MCP wake 全链路（在 `core/` Team 运行时上接）

## P2 — 多机（Multica 语义）

- [x] TS 面：多 runtime / heartbeat / 并发上限 / 手动 claim / blocker→owner / 看板只读
- [ ] 上述语义由 `core/` Fleet 路由成为 SSOT 后，壳改打 Core

## P3 — 产品化

- [x] 穿透文档、执行日志/用量、hive 导入（TS 面）
- [ ] Core 侧执行日志/用量持久化与导入 API 对齐

## 非目标（一期）

- 公有云代跑 · 内置 frp/ngrok · 完整 Pixi 楼进 AionUi · vendor Multica 源码
