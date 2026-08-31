# HANDOFF — munder-fleet-a

> 给下一个人类或 Cloud Agent：读完本文即可理解本仓状态。**本仓一期语义面已收口。**

## 本仓状态（2026-08-31）

| 项 | 状态 |
|----|------|
| PR #1 / #2 | 已合入 `main` |
| P0–P3 语义面（`src/fleet` + `shell/`） | 完成，可演示 |
| Multica | 仅语义对齐，未 vendor 源码 |
| 后续主战场 | **`vega0707/AionCore`**（Fleet Rust 路由），不是继续堆本仓 |

验证：

```bash
./scripts/bootstrap-forks.sh   # 可选，拉 refs/
npm test
npm run demo                   # claim→subprocess→michael
npm run demo:full              # + persist + peer runtime + hive
npm run verify:core            # 需已 build refs/AionCore
npm run overlay:core           # 仅 migration/docs → refs/AionCore
```

## 背景（从哪来）

产品方要把 **Munder Difflin（表现层）**、**Aion 系（Core/远程/Team）**、**Multica（多机接活）** 整合成一个大产品。本仓是 Strategy **A**（激进：AionCore 主后端）。

拍板要点：无双模式；assignee 看板；Electron 本机免鉴权 / Web 必鉴权；HITL 待定硬闸。

## 本仓已交付

- Fleet 类型：Runtime / Task(assignee) / PendingDecision / ExecutionLog / Michael inbox
- SQLite 持久化；loopback 鉴权合同冻结；Web 优先代理 AionCore JWT
- DecisionGate；多 runtime / heartbeat / 并发上限；hive 导入；穿透文档
- Overlay：`overlays/aioncore-fleet`（migration + 合入说明）

## 明确不要在本仓再做的事

- 不要用 AionUi 替换 Munder 默认壳
- 不要整仓拷贝 Multica；不要 `solo|distributed` 枚举
- 不要在未读 `COPY_MAP.md` 前大面积合并上游
- 不要猜测 Agent CLI 线协议
- **不要**在本仓再平行实现一套「未来的 Core Fleet」——去 `vega0707/AionCore` 合 Rust

## 后续（有写权限的 agent / 人工 · 外仓）

1. 在 [`vega0707/AionCore`](https://github.com/vega0707/AionCore) 实现 `aionui-fleet`（对齐本仓 `src/fleet` API 语义）
2. Team MCP wake 全链路（依赖 Core Team 运行时）
3. 真实 Claude/Codex CLI（有抓包/文档再接）
4. 回写本仓：`docs/VERSIONS.md` / `DECISIONS.md` 记录 Core fork 合入 SHA（小文档 PR即可）

## 联系语境

- 表现层品牌：**Munder**
- 编排者：**Michael**（Aion Lead / Multica squad leader 映射）
- 分布式接活：角色绑定本机 CLI，claim 后问题问角色主人，完成回传 Michael
