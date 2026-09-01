# munder-fleet-b 文档同步包

Cloud Agent 运行环境仅对 [`munder-fleet-a`](https://github.com/vega0707/munder-fleet-a) 有写权限，无法直接 push `vega0707/munder-fleet-b`。

本目录包含应落入 **munder-fleet-b** 的 WorkBuddy 调研与 P4 路线图变更。

## 内容

| 文件 | 目标路径（fleet-b 仓库根） |
|------|---------------------------|
| `overlay/docs/WORKBUDDY_ANALYSIS.md` | `docs/WORKBUDDY_ANALYSIS.md` |
| `overlay/docs/ROADMAP.md` | `docs/ROADMAP.md` |
| `overlay/docs/HANDOFF.md` | `docs/HANDOFF.md` |
| `overlay/docs/DECISIONS.md` | `docs/DECISIONS.md` |
| `overlay/README.md` | `README.md` |

## 一键应用到 fleet-b

在 **munder-fleet-b** 仓库根目录执行：

```bash
# 若从 fleet-a 克隆后
./contrib/munder-fleet-b-docs/apply-to-fleet-b.sh

# 或指定 overlay 路径
/path/to/munder-fleet-a/contrib/munder-fleet-b-docs/apply-to-fleet-b.sh /path/to/munder-fleet-b
```

## 手动应用

```bash
cp -r contrib/munder-fleet-b-docs/overlay/* /path/to/munder-fleet-b/
```

然后于 fleet-b 提交：

```bash
git checkout -b cursor/workbuddy-analysis-f201
git add docs/WORKBUDDY_ANALYSIS.md docs/ROADMAP.md docs/HANDOFF.md docs/DECISIONS.md README.md
git commit -m "docs: WorkBuddy 调研与 Strategy B 对标建议"
```
