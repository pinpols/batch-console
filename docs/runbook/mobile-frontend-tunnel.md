---
title: 使用 Cloudflare Named Tunnel 暴露本地前端（runbook）
summary: 使用 `cloudflared` 创建命名 Tunnel，使本地开发机在有域名时短时对外可访问；若无域名，提供 Tailscale Funnel 作为替代方案。
---

# 概要

本文档记录在本地通过 Cloudflare Named Tunnel（cloudflared）暴露前端服务的标准运行手册。适用于开发或演示场景：当你在自己 Mac 上运行前端（例如 Vite 的 `localhost:5173`）并希望通过一个永久域名（由 Cloudflare 管理）对外访问时使用。本方法不会长期暴露端口 —— 只要 `cloudflared` 进程停止，外部访问即断开。

如果你没有 Cloudflare 账号或没有可用域名，请考虑使用 Tailscale Funnel（无需域名，快速 10 分钟完成）。文档最后给出替代建议。

前提条件
- 已安装 `cloudflared`，并能在终端运行（通常来自 Homebrew 或官方安装包）。
- 你能访问 Cloudflare 仪表板并对目标域名有 DNS 管理权限（必要时可创建 `fe.xxx.com` 的 CNAME/记录）。

注意：示例中以 Mac 路径为例（`/Users/<you>/.cloudflared/`），请替换为你本地的用户名和实际生成的 `<uuid>.json` 文件名。

步骤

1. 登录 Cloudflare（会在浏览器弹出授权页面）

```bash
cloudflared tunnel login
```

执行后会在浏览器打开 Cloudflare 登录/授权页面，完成后 `cloudflared` 会把生成的凭据保存到 `~/.cloudflared/` 下（包含 account info）。

2. 创建命名 Tunnel

```bash
cloudflared tunnel create batch-console
```

命令输出会包含 `tunnel ID` 和一条提示，指出凭据文件已写入：

- 文件路径示例：`/Users/dengchao/.cloudflared/<uuid>.json`
- 注意：`cloudflared` 创建的隧道在 Cloudflare 管理面板中可见（Cloudflare Zero Trust → Access → Tunnels）。

3. 添加 DNS 路由（前提：域名由 Cloudflare 托管）

```bash
cloudflared tunnel route dns batch-console fe.xxx.com
```

这会在你的 Cloudflare 域的 DNS 下添加一个记录，将 `fe.xxx.com` 指向该隧道。确认域名 `fe.xxx.com` 已被正确分配并解析到 Cloudflare。

4. 在本地写 `~/.cloudflared/config.yml`

将下面内容写入 `~/.cloudflared/config.yml`，并把 `credentials-file` 的路径替换为第 2 步生成的凭据路径（即 `~/.cloudflared/<uuid>.json`）。示例：

```yaml
tunnel: batch-console
credentials-file: /Users/dengchao/.cloudflared/<uuid>.json
ingress:
  - hostname: fe.xxx.com
    service: http://localhost:5173
  - service: http_status:404
```

说明：
- `hostname`：Cloudflare 上添加的域名
- `service`：本地要转发的地址（前端 dev server，示例为 `localhost:5173`）
- 最后一条规则为兜底，未匹配时返回 404

5. 启动 Tunnel

```bash
cloudflared tunnel run batch-console
```

启动成功后，你应能通过 https://fe.xxx.com 访问本地运行的前端（示例：Vite）。当你终止该进程或机器关机时，域名不可访问。

可选：作为守护进程运行

- macOS：建议用 `launchd` 将 `cloudflared tunnel run` 设置为用户守护进程（或使用 `cloudflared service install`，若可用）。
- Linux：使用 systemd unit 或 `cloudflared service install`。

其他注意事项

- TLS/证书：Cloudflare 为 `fe.xxx.com` 提供 TLS。若你的浏览器或中间链路出现证书问题，请在 Cloudflare Dashboard 检查 SSL/TLS 设置（通常选择 Full 或 Full (strict)）。
- Header/Host：Cloudflare 会转发 Host header；若本地服务器基于 Host 做校验，请确保允许 `fe.xxx.com`。
- CORS：若前端调用后端 API（不同域），请确认后端允许来自 `fe.xxx.com` 的请求或使用代理。

故障排查快照

- 如果 `cloudflared tunnel run` 报 `credentials-file not found`：确认第 2 步创建的 `<uuid>.json` 存在且 `config.yml` 路径正确。
- 如果 DNS 未生效：登录 Cloudflare 仪表板确认 DNS 记录存在，或 `dig fe.xxx.com` 检查解析。
- 如果页面加载但资源 404/跨域：检查 `ingress` 中 `service` 的端口是否正确，以及前端 dev server 是否监听所有接口（0.0.0.0）或仅 localhost。

---

# 替代方案 A：Tailscale Funnel（无域名，推荐）

## 适用场景

- 没有自己的域名，也没有 Cloudflare 账号
- 临时演示 / 移动端联调 / 远程同事访问 Vite dev server
- 接受 `*.ts.net` 子域名而非自有域名

## 优缺点

| 维度 | 说明 |
|------|------|
| 域名 | Tailscale 免费分配 `<machine>.<tailnet>.ts.net`，自动 TLS |
| 端口 | 仅 443 / 8443 / 10000 三选一对公网开放 |
| 流量 | 走 Tailscale 边缘，免费版有用量限制（个人足够） |
| 鉴权 | Funnel 公开；若只想 Tailnet 内部访问用 `tailscale serve` |
| 依赖 | 本机需常驻 `tailscaled` 进程 |

## 前置条件

- 一个 Tailscale 账号（GitHub / Google 一键登录免费）
- 本地前端能在 `localhost:5173` 跑通（`npm run dev`）

## 步骤

### 1. 安装 Tailscale（Mac）

```bash
brew install --cask tailscale
open -a Tailscale
```

或直接下载 [tailscale.com/download/mac](https://tailscale.com/download/mac)。安装后菜单栏会出现图标。

### 2. 登录并加入 Tailnet

点击菜单栏图标 → `Log in...` → 浏览器完成 OAuth。登录后本机自动获得一个 `100.x.x.x` 的 Tailscale IP 和形如 `mac-mini.taild1234.ts.net` 的 MagicDNS 名。

验证：

```bash
tailscale status
tailscale ip -4
```

### 3. 在 Admin 面板启用 Funnel 能力

访问 [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns)：
- 确认 **MagicDNS** 已开启
- 确认 **HTTPS Certificates** 已开启（Funnel 强依赖）

然后到 [login.tailscale.com/admin/acls](https://login.tailscale.com/admin/acls)，在 ACL JSON 里追加（或确认已有）：

```jsonc
{
  "nodeAttrs": [
    {
      "target": ["autogroup:member"],
      "attr":   ["funnel"]
    }
  ]
}
```

保存。这一步把 Funnel 权限授予 Tailnet 内所有成员（个人账号默认就你一个）。

### 4. 启动 Funnel 暴露 5173

```bash
# 前台运行（调试用，Ctrl+C 即停）
tailscale funnel --bg=false 5173
```

或后台常驻：

```bash
tailscale funnel --bg 5173
```

终端会打印类似：

```
Available on the internet:

https://mac-mini.taild1234.ts.net/
|-- proxy http://127.0.0.1:5173
```

把这个 URL 发给手机 / 同事即可访问。

### 5. 验证

```bash
# 查看当前 Funnel/Serve 配置
tailscale funnel status

# 手机浏览器打开 https://mac-mini.taild1234.ts.net/
# 或本机 curl 验证
curl -I https://mac-mini.taild1234.ts.net/
```

### 6. 停止

```bash
tailscale funnel --https=443 off
# 或一键清空所有 serve/funnel 配置
tailscale serve reset
```

## Vite 配置要点

Vite 默认只监听 `localhost`，Funnel 转发到 `127.0.0.1:5173` 没问题，但要让 Vite 接受外部 Host header，在 [vite.config.ts](vite.config.ts) 加：

```ts
export default defineConfig({
  server: {
    host: '127.0.0.1',           // Funnel 走本地回环即可，无需 0.0.0.0
    allowedHosts: ['.ts.net'],   // 关键：放行 *.ts.net
    hmr: {
      clientPort: 443,           // HMR websocket 走 Funnel 的 443
      protocol: 'wss',
    },
  },
})
```

不加 `allowedHosts` 会看到 `Blocked request. This host is not allowed.`。

## 故障排查

| 现象 | 排查 |
|------|------|
| `funnel: not permitted` | ACL 里 `nodeAttrs.funnel` 没生效；admin 面板重保存一次 |
| `HTTPS certificates are not enabled` | DNS 设置页打开 HTTPS Certificates，等 30s 重试 |
| 手机能开但 HMR 黑屏 | Vite `hmr.clientPort/protocol` 没配，见上 |
| `Blocked request` | Vite `server.allowedHosts` 追加 `.ts.net` |
| 后台进程消失 | `tailscale funnel --bg` 重起；或写 launchd plist 常驻 |

## 仅内网共享（不要公网）

如果只是手机和电脑都在自己 Tailnet 里，**不要用 Funnel**，用 Serve：

```bash
tailscale serve 5173
```

URL 仍是 `https://mac-mini.taild1234.ts.net/`，但只有登录同一 Tailnet 的设备可达，安全性更高、零公网暴露。

---

# 替代方案 B：其他无域名快速方案

| 工具 | 一行命令 | 域名形态 | 备注 |
|------|----------|----------|------|
| TryCloudflare | `cloudflared tunnel --url http://localhost:5173` | 随机 `*.trycloudflare.com` | 重启变 URL，纯临时 |
| ngrok | `ngrok http 5173` | 随机 `*.ngrok-free.app` | 免费有连接数限制 |
| localhost.run | `ssh -R 80:localhost:5173 nokey@localhost.run` | 随机 `*.lhr.life` | 零安装，仅需 ssh |
| bore | `bore local 5173 --to bore.pub` | `bore.pub:<port>` | Rust 实现，无 TLS |

---
最后更新：2026-05-16
