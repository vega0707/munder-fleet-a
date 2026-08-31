# HANDOFF — munder-fleet-a

> 给下一个人类或 Cloud Agent：读完本文即可开工。**本仓 = monorepo**（壳 + Fleet 语义 + vendored AionCore）。

## 本仓状态（2026-08-31）

| 项 | 状态 |
|----|------|
| PR #1 / #2 | 已合入 `main`（TS Fleet P0–P3 语义面） |
| AionCore | **vendor 在 `core/`**（钉 SHA，Apache-2.0） |
| Multica | 仅语义对齐，**不** vendor |
| A/B/C/D | 最终用户表现应对齐；实现栈不同——A = Core monorepo |

```bash
npm test && npm run demo && npm run demo:full
npm run verify:core      # 编 core/ 并打 /health + JWT
npm run overlay:core     # 把 Fleet migration 再打进 core/
npm run sync:core        # 从上游按 pin 刷新 core/（维护者）
```

## 背景

产品方要把 Munder / Aion / Multica 合成一个大产品。四条策略仓探索不同主核；**表现层目标一致**（Munder 壳、assignee、本机免登、待定硬闸、claim、回传 Michael）。

本仓 Strategy **A**：AionCore 作控制面，收进同一仓库。

## 立刻该做（按序）

1. 读本文件 + `docs/DECISIONS.md`（含 monorepo 决策）
2. `npm test` / `npm run demo:full`
3. 在 **`core/`** 实现 `aionui-fleet` Rust 路由（对齐 `src/fleet`）；migration 已在 `core/crates/aionui-db/migrations/044_*`
4. Team MCP wake / 真 Agent CLI：有依据再做（禁止猜协议）

## 不要做

- 不要用 AionUi 替换 Munder 默认壳
- 不要整仓拷贝 Multica；不要 `solo|distributed`
- 不要未读 `COPY_MAP.md` 就大面积合并上游
- 不要再把「改外仓 fork」当主路径——主树就是 `core/`

## 联系语境

- 品牌：**Munder** · 编排者：**Michael**
- 分布式：角色绑本机 CLI，claim 后问角色主人，完成回传 Michael
