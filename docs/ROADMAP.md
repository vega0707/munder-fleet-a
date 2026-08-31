# ROADMAP — Strategy A

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
- [x] Team MCP wake 桥接：Fleet 完成/idle → AionCore team mailbox（`aionui-fleet` `TeamNotifyPort` → `FleetTeamMailboxNotify` 写 `message`/`idle_notification` 给 team lead；`cargo test` 覆盖 + local 实机验证）

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

## 仍待人工 / org fork

- [x] GitHub 创建 AionCore fork → `vega0707/AionCore`（fork 点 `9bfb2ad`，见 `overlays/aioncore-fleet/FORK_POINT.md`）
- [x] `aionui-fleet` crate 合入 fork：`/api/fleet/*` 路由（register/heartbeat/claim/claim-and-work/decisions/michael/logs/import/hive）+ DecisionGate + `--local` 免鉴权 + Web auth middleware；`cargo test -p aionui-fleet` 6 用例通过；Team mailbox 桥（B）实机验证
- [ ] 真实 Agent CLI（Claude/Codex）接线 — 禁止猜测 CLI 协议；需抓包/文档后再断言（本环境无 `~/aion/protocols/samples/` 依据，未做）
