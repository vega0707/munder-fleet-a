# munder-fleet-a — Strategy A（激进整合）

**一句话：** 以 **AionCore fork** 做 Control/Runtime 平面；按 **Multica 语义**实现多机 claim/runtime；**Munder Difflin** 只做表现层壳。

本地不是第二种模式：**Fleet 单节点拓扑**（1 owner · 1+ local runtime）。

| | |
|--|--|
| 策略代号 | **A** |
| 姊妹仓（含 [`munder-fleet-d`](../munder-fleet-d)） | [`munder-fleet-b`](../munder-fleet-b)（中等）· [`munder-fleet-c`](../munder-fleet-c)（自研对齐） |
| 上游对照 | [iOfficeAI/AionCore](https://github.com/iOfficeAI/AionCore) · [iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi) · [multica-ai/multica](https://github.com/multica-ai/multica) · [vega0707/munder-difflin](https://github.com/vega0707/munder-difflin) |
| 状态 | **P0–P3 语义面可演示** · AionCore 钉版 + Fleet（SQLite/Worker/Gate）+ Munder 壳 · Core Rust 合入待 org fork |

## 你要做什么（执行顺序）

1. 读 [`docs/HANDOFF.md`](./docs/HANDOFF.md)（交接必读）
2. 读 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) + [`docs/COPY_MAP.md`](./docs/COPY_MAP.md)
3. 跑 [`scripts/bootstrap-forks.sh`](./scripts/bootstrap-forks.sh)（fork/clone 上游到 `refs/`）
4. 按 [`docs/ROADMAP.md`](./docs/ROADMAP.md) P0→P3 推进
5. **不要**把 Multica 源码当可商用 SaaS 组件直接嵌入对外售卖产品——见许可专节

## 本地 = 分布式的一种用法

```
Project → Tasks(assignee) → Runtime(s) → Agent CLI
PendingDecision → owner

本地开箱：Runtime=本机自动注册，Owner=你，Electron 免鉴权
多机：N 个 daemon 注册，claim / blocker 按 owner
```

无 `solo|distributed` 开关。

## 许可红线（必读）

| 上游 | SPDX / 备注 | 本仓策略 |
|------|-------------|----------|
| AionCore / AionUi / aionrs | **Apache-2.0** | 可 fork 合入，保留 NOTICE/版权 |
| Multica | **Apache-2.0 + 附加条件**（限制把源码做成对外托管/嵌入式商业组件） | **默认：协议级重写**，不整仓合并源码；若必须 vendor 源码，先法务确认 |
| Munder Difflin | MIT（以该仓 LICENSE 为准） | 表现层可引用/子模块 |

## 仓库布局

```
munder-fleet-a/
  README.md
  AGENTS.md
  package.json
  docs/                     # HANDOFF / ROADMAP / VERSIONS / TUNNELING …
  overlays/aioncore-fleet/  # Core migration overlay
  scripts/
    bootstrap-forks.sh
    demo-p0.sh / demo-full.sh
    verify-aioncore.sh
    apply-fleet-overlay.sh
  shell/                    # 最小 Munder Web 壳
  src/fleet/                # Fleet 语义控制面
  refs/                     # gitignore：本地上游克隆
```

## 成功标准（Definition of Done · P0）

- [x] `refs/AionCore` 可编译启动，JWT + 健康检查可用（`npm run verify:core`）
- [x] Munder 壳能连 Core（loopback 免鉴权冻结；Web 优先 Core JWT）
- [x] 数据模型含：Project、Task(assignee)、Runtime、PendingDecision(owner) + SQLite
- [x] 单机自动注册 local runtime；claim→subprocess 干活→回传 Michael（`npm run demo` / `demo:full`）
- [x] 文档写明 Multica 为语义对齐而非源码合并（除非法务放行）

P1–P3 勾选见 [`docs/ROADMAP.md`](./docs/ROADMAP.md)。
