# FE 脚本部署 E2E 验证(2026-05-28)

本次目的:验证 PR #28 之后切到本地脚本部署的链路在 FE 端仍然通畅。

## 链路

```
PR merge → main
  ↓ schtasks BatchDeployFE(每 1 min,wscript 隐窗)
  ↓ deploy-fe.ps1:git fetch origin main → 比较 HEAD → pull --ff-only
  ↓ docker compose -p batch-platform-console up -d --build --wait
  ↓ batch-console 容器 healthy
```

## 预期

- 此 PR squash merge 到 main 后 60-120s 内,`C:\Users\aa\logs\deploy-fe.log` 出现:
  - `UPDATE detected: <old-sha> -> <new-sha>`
  - `git pull` Fast-forward
  - `docker compose build + up start`
  - `compose finished rc=0`
- `docker ps batch-console` 重启时间归零(`Up X seconds`)
- 无 PowerShell / wscript 窗口闪现(VBS wrapper 起作用)

## 失败处理

- FETCH FAILED — 18081 代理抽风,脚本下轮会自己重试,无需介入
- compose timeout — 看末 15 行日志(脚本会附通知),按情况 docker logs / restart

## 结果

(merge 后填)

