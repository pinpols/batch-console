# 移动端本地联调隧道

用于在手机或受控演示设备访问本机开发前端。它不是生产部署入口；使用测试账号和合成数据，确认 API 代理、登录 Cookie、CSRF 与访问范围符合本次联调需要。

## 启动前端

仓库现有 `vite.config.ts` 已支持开发隧道 Host，并用 `VITE_HMR_TUNNEL=1` 将 HMR 设为 `wss:443`。通过 HTTPS 隧道访问时使用：

```bash
VITE_HMR_TUNNEL=1 npm run dev
```

直接访问 `localhost:5173` 时使用普通 `npm run dev`。后端代理由 `VITE_DEV_PROXY_TARGET` 指向本次联调 API；更改该变量后重启当前开发服务。不要为一次联调复制另一份 `server.allowedHosts/hmr` 配置或修改生产 Nginx。

## Cloudflare 命名 Tunnel

前提是已安装 `cloudflared`，拥有对应 Cloudflare 账号与域名的管理权限。下列命令会创建外部资源，只在已授权的联调中操作。

```bash
cloudflared tunnel login
cloudflared tunnel create batch-console
cloudflared tunnel route dns batch-console fe.example.com
```

根据命令返回的 tunnel ID 与实际凭据文件，在本机私有的 `~/.cloudflared/config.yml` 配置：

```yaml
tunnel: replace-with-tunnel-id
credentials-file: /path/to/private/cloudflared/replace-with-tunnel-id.json
ingress:
  - hostname: fe.example.com
    service: http://127.0.0.1:5173
  - service: http_status:404
```

凭据不写入仓库。随后运行 `cloudflared tunnel run batch-console`；确认外部 URL、主机名和访问策略正确，再在手机验证页面、登录、租户、API 与 HMR。退出前台 tunnel 进程结束本轮连接；若已经配置后台服务，应按该机器的服务管理方式停止。

## Tailscale

设备属于同一 Tailnet 时，可优先通过受控的 `tailscale serve` 访问；需要公网 Funnel 时，先确认当前账号和 Tailnet 策略允许，并理解公网访问范围。命令与账号能力按已安装版本的帮助及服务官方文档核对：

```bash
tailscale serve --help
tailscale funnel --help
```

记录本轮实际 URL 与所创建的 Serve/Funnel 配置，结束后移除该映射。不要为停止一个端口而直接重置他人共用的所有 Serve/Funnel 配置。

## 排查

| 现象 | 优先检查 |
|---|---|
| 页面可开但热更新失败 | 前端是否以 `VITE_HMR_TUNNEL=1` 启动，隧道是否支持 WebSocket |
| API 失败或登录后401 | 本次 Vite proxy 目标、后端健康、Cookie/CSRF 和外部访问的同源行为 |
| Host 拒绝 | 实际运行的是否为当前 WDI 前端，是否有额外代理主机校验 |
| Tunnel 凭据不存在 | 配置引用的实际凭据文件和权限，不把凭据内容贴入日志 |
| 断开后仍可访问 | 检查是否存在本轮创建的后台进程或服务，再停止相应映射 |

本地 `5174` 通常用于统一文档预览；隔离前端使用其他端口时，隧道目标必须跟随当前实际进程。设备可访问页面不等于已通过移动端真机手势、软键盘或完整业务验收。
