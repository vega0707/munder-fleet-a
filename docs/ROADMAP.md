# ROADMAP — Strategy A

> **本仓一期：已收口**（`main` 含 #1 + #2）。下列未勾项属于 **外仓 / 有权限集成**，不阻塞本仓演示。

## P0 — Core 立住 + 单节点 Fleet

- [x] Fork AionCore，钉版本，跑通健康检查与 JWT（`docs/VERSIONS.md` · `scripts/verify-aioncore.sh`）
- [x] 扩展最小 Fleet 表/类型：Runtime、PendingDecision（`src/types.ts` + SQLite）
- [x] 本机自动 register runtime（`runtime:local`）
- [x] Munder 或最小壳：登录（Web / Core JWT）/免登（loopback 冻结）、任务列表、待定列表（`shell/`）
- [x] DoD：单机 claim→**干活(subprocess)**→完成回传可演示（`npm run demo` / `demo:full`）

## P1 — Team 协作（Aion）

- [x] Michael/Lead 收完成（`/api/fleet/michael/inbox`；idle 可后续接 Team MCP wake）
- [x] DecisionGate：pending 时拒绝新 claim/start（409）
- [x] Electron 本机免鉴权通道冻结（`LOOPBACK_AUTH_CONTRACT`）
- [ ] Team MCP wake 全链路 → **外仓** AionCore Team 运行时（本仓不阻塞）

## P2 — 多机（Multica 语义）

- [x] 第二台机器 runtime 注册 + heartbeat（`register` + `/heartbeat`；`demo:full`）
- [x] 手动 claim（`taskId`）+ 自动 claim（`maxConcurrentTasks` 并发上限）
- [x] Blocker 只推给 role owner（`PendingDecision.ownerId`）
- [x] 项目内看板只读可见他人进行中任务（assignee 模型不变 · `listTasks`）

## P3 — 产品化

- [x] 穿透文档（自备，不内置）— `docs/TUNNELING.md`
- [x] 执行日志/用量 — `/api/fleet/logs`（tokensIn/Out）
- [x] 从 Munder 迁移 hive 任务导入 — `/api/fleet/import/hive`

## 非目标（本仓一期）

- 公有云代跑 agent 算力
- 内置 frp/ngrok 一键隧道
- 完整 Pixi 楼移植进 AionUi

## 外仓后续（非本仓阻塞）

| 项 | 落点 |
|----|------|
| 个人 fork 已存在 | [`vega0707/AionCore`](https://github.com/vega0707/AionCore)（仍为上游镜像，尚无 Fleet 提交） |
| Rust Fleet 路由 | 在该 fork 实现；本仓 `overlays/aioncore-fleet` + `npm run overlay:core` 仅 migration/docs |
| 真 Agent CLI | 禁止猜协议；有依据后再接 |
| 回写钉 SHA | 合入后小 PR 更新本仓 `VERSIONS` / `DECISIONS` |
