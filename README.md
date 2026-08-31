# munder-fleet-a — Strategy A（激进整合 · monorepo）

**一句话：** **AionCore 源码在本仓 `core/`** 作 Control/Runtime；按 **Multica 语义**做 claim/runtime；**Munder** 只做表现层壳。

本地不是第二种模式：**Fleet 单节点拓扑**（1 owner · 1+ local runtime）。

| | |
|--|--|
| 策略代号 | **A** |
| 布局 | **单仓**：`shell/` + `src/fleet` + **`core/`（vendored AionCore）** |
| 姊妹仓 | [`munder-fleet-b`](../munder-fleet-b) · [`c`](../munder-fleet-c) · [`d`](../munder-fleet-d)（最终**表现**应对齐，主核不同） |
| 上游 | [iOfficeAI/AionCore](https://github.com/iOfficeAI/AionCore) · Multica（语义）· [munder-difflin](https://github.com/vega0707/munder-difflin) |
| 状态 | P0–P3 TS 语义面可演示；Core 已 vendor；Rust Fleet 路由待在 `core/` 落地 |

## 你要做什么

1. 读 [`docs/HANDOFF.md`](./docs/HANDOFF.md)
2. `npm test && npm run demo && npm run demo:full`
3. `npm run verify:core`（编译/验证 `core/`）
4. 在 **`core/`** 实现 Fleet HTTP 路由（见 `overlays/aioncore-fleet/`）
5. **不要** vendor Multica 源码；**不要** `solo|distributed`

## 仓库布局

```
munder-fleet-a/
  core/                 # vendored AionCore（Apache-2.0，钉 SHA）
  src/fleet/            # Fleet 语义对照 + 演示 API（TS）
  shell/                # 最小 Munder Web 壳
  overlays/aioncore-fleet/
  docs/
  scripts/              # sync-core / verify-core / demo*
  refs/                 # gitignore：可选上游镜像
```

## 许可红线

| 上游 | 策略 |
|------|------|
| AionCore | 已 vendor 进 `core/`；保留 LICENSE/NOTICE |
| Multica | **协议重写 only** |
| Munder Difflin | 表现层 MIT 基线 |

## P0 DoD

- [x] `core/` 可编译；JWT + health（`npm run verify:core`）
- [x] 壳 loopback 免登 / Web 鉴权路径
- [x] Project / Task(assignee) / Runtime / PendingDecision + SQLite（TS 面）
- [x] claim→subprocess→Michael（`npm run demo`）
- [x] Multica = 语义对齐已文档化
- [ ] Rust Fleet API 在 `core/` 成为 SSOT
