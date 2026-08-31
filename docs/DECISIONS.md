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

## 2026-08-31 — Fleet 合入 Core fork（主任务 A）

- **fork 策略**：org 下 fork `iOfficeAI/AionCore`（钉点 `9bfb2adbab1aca47bcd1a644446aeee6c41aab4f`，Apache-2.0 保留 NOTICE）；本仓经 `overlays/aioncore-fleet` + `scripts/apply-fleet-overlay.sh` 跟踪。
- **crate 命名**：`aionui-fleet`（Core 内新建 crate），表 `fleet_runtimes / fleet_pending_decisions / fleet_execution_logs` 沿用 overlay migration；API 行为对齐本仓 `src/fleet`（register/heartbeat/claim/claim-and-work/decisions/michael/logs），不抄 Multica 源码。
- **鉴权**：`--local` 免鉴权（system_default_user）；Web 走 AionCore 既有 JWT/CSRF 中间件。
- **DecisionGate**：owner 存在 pending 时拒绝新 claim/start（409）；工具闸后续可挂。
- **验收**：`just check` / `cargo test` 可编译；`npm run verify:core` 仍过；文档标注 Multica=语义对齐、fork SHA 可追溯。

## 2026-08-31 — Team MCP wake 桥接（任务 B）

- Fleet 完成/idle 事件经 `TeamNotifyPort`（`aionui-fleet` crate）写入 AionCore `mailbox` 表（`message` / `idle_notification`，to=team lead），复用 AionCore Team 既有 event loop 的 wake 落点；不做 CLI 协议猜测（无抓包依据）。
