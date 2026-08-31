# 穿透 / 远程访问（自备，不内置）

本仓**一期非目标**：不内置 frp/ngrok 一键隧道。

## 推荐自备方式

1. **SSH 反向隧道**（团队已有跳板机时）  
   `ssh -R 25808:127.0.0.1:25808 user@bastion`
2. **Tailscale / Headscale** — 把运行 AionCore 与 Fleet 的机器拉进同一 mesh；Web 壳走鉴权。
3. **自建 frp/ngrok** — 运维侧部署；不要把 token 写进本仓。

## 鉴权提醒

- Electron / loopback：免鉴权（`LOOPBACK_AUTH_CONTRACT.frozen`）。
- Web / 远程：**必须**鉴权；优先 AionCore JWT（Fleet `--mode web --core-base …`）。

## 端口

| 服务 | 默认 |
|------|------|
| AionCore | `127.0.0.1:25808` |
| Munder Fleet 壳 | `127.0.0.1:3847` |
