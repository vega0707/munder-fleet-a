# DECISIONS — Strategy A

## 2026-08-31 — 单一 Fleet 协议

本地是拓扑退化，不是模式开关。

## 2026-08-31 — 主后端选 AionCore

激进路线：Rust Core 作控制面；Munder 作壳。

## 2026-08-31 — Multica 只对齐语义

因 Multica License Part I 限制托管/嵌入式商业分发，默认协议重写，不整仓合并。

## 2026-08-31 — 看板

保持 assignee；不做按角色分泳道的强制改版。

## 2026-08-31 — P0 Fleet 平面先落在本仓 `src/`

P0 将 Multica **语义**（Runtime 注册 / claim / PendingDecision / 完成回传 Michael）实现为本仓 TypeScript 控制面（`src/fleet` + `shell/`），不 vendor Multica 源码。  
AionCore 钉在 `docs/VERSIONS.md` 的 fork 点，用 `scripts/verify-aioncore.sh` 证明 `/health` + JWT。  
目标态仍是把 Fleet 合入 AionCore fork；P0 用可演示的协议层解耦编译面与产品壳。

## 2026-08-31 — 补齐 P0 缺口并完成 P1–P3（本仓语义面）

- SQLite 持久化；`claim-and-work` 真实 subprocess；Web 登录优先代理 AionCore JWT；loopback 合同冻结。
- P1 DecisionGate + Michael inbox；P2 多 runtime/heartbeat/并发上限/手动 claim；P3 日志用量、hive 导入、穿透文档。
- AionCore 合入路径：`overlays/aioncore-fleet` + `scripts/apply-fleet-overlay.sh`（migration 先行；Rust 路由待 org fork）。
- 明确未做：真实 Team MCP wake 全链路、真实 Agent CLI 协议、GitHub org fork 创建。

## 2026-08-31 — AionCore 收入本仓 monorepo（`core/`）

产品方要求 A/B/C/D **最终表现一致**，A 线实现改为 **单仓**：把钉住的 AionCore 源码 vendor 进本仓 `core/`（保留 Apache-2.0 LICENSE/NOTICE，记录 fork SHA），Fleet overlay 直接打进 `core/`，不再以「外仓改 fork」为主路径。  
`refs/` 仍可作其它上游对照克隆（gitignore）；Multica **仍不** vendor。  
Rust Fleet 路由在本仓 `core/` 上继续演进；TS `src/fleet` 继续作语义对照与演示壳后端，直至 Core 路由对齐后收敛。
