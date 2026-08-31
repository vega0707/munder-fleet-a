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
