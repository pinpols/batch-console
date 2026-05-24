#!/usr/bin/env pwsh
<#
.SYNOPSIS
    batch-console 前端 Docker 部署助手（Windows / PowerShell 7+）。

.DESCRIPTION
    包装 docker compose，统一注入 HOST_PORT / BACKEND_UPSTREAM_HOST / BUILD_MODE 三个变量，
    省去每次手敲一长串环境变量。镜像为多阶段构建（node 构建 dist → nginx 部署），
    详见 docs/deploy/docker-nginx.md。

.PARAMETER Action
    up       构建并（重新）启动容器，后台运行（默认）
    build    仅构建镜像，不启动
    down     停止并移除容器
    restart  重启容器（不重新构建）
    logs     跟随查看容器日志（Ctrl+C 退出）
    status   查看容器健康状态 + 渲染后的 nginx 配置
    open     在默认浏览器打开前端首页

.PARAMETER Port
    宿主机对外端口，默认 8080（容器内固定 80）。

.PARAMETER Backend
    后端上游地址 host:port。留空（默认）则沿用 docker-compose.yml 里的默认上游
    （当前 host.docker.internal:18090）；传值则覆盖。compose 文件是默认值的唯一真源。
    （Windows Docker Desktop 下 host.docker.internal 直接指向宿主机）。

.PARAMETER BuildMode
    build:fast 只跑 vite build（默认，快）；build 额外跑 vue-tsc 全量类型检查（慢 ~20s）。

.EXAMPLE
    ./scripts/deploy.ps1 up
    ./scripts/deploy.ps1 up -Port 80 -Backend 10.0.0.5:18080
    ./scripts/deploy.ps1 up -BuildMode build       # 严格类型检查构建
    ./scripts/deploy.ps1 logs
    ./scripts/deploy.ps1 down
#>
[CmdletBinding()]
param(
    [ValidateSet('up', 'build', 'down', 'restart', 'logs', 'status', 'open')]
    [string]$Action = 'up',

    # 默认 19080：本机 8080 落在 Hyper-V/WinNAT 保留段(8067-8166)，Docker 绑不上
    [int]$Port = 19080,

    # 留空 = 用 docker-compose.yml 的默认上游（当前 host.docker.internal:18090）；传值则覆盖
    [string]$Backend = '',

    [ValidateSet('build:fast', 'build')]
    [string]$BuildMode = 'build:fast'
)

$ErrorActionPreference = 'Stop'

# 始终以脚本所在仓库根为工作目录，无论从哪里调用
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Compose  = Join-Path $RepoRoot 'docker-compose.yml'
$Container = 'batch-console'

if (-not (Test-Path $Compose)) {
    throw "找不到 docker-compose.yml：$Compose"
}

# docker compose 通过环境变量读取 ${HOST_PORT} / ${BACKEND_UPSTREAM_HOST} / ${BUILD_MODE}
$env:HOST_PORT  = "$Port"
$env:BUILD_MODE = $BuildMode
# 只有显式传 -Backend 才覆盖上游；否则交给 docker-compose.yml 的默认值（唯一真源），
# 避免脚本默认与 compose 文件漂移（曾因脚本写死 18080 覆盖了 compose 的 18090）。
if ($Backend) { $env:BACKEND_UPSTREAM_HOST = $Backend }
else { Remove-Item Env:BACKEND_UPSTREAM_HOST -ErrorAction SilentlyContinue }

# 统一的 compose 基础参数（绑定文件 + 项目目录，使脚本可从任意 cwd 调用）
$base = @('compose', '-f', $Compose, '--project-directory', $RepoRoot)

function Invoke-Compose { docker @base @args }

# Docker daemon 可达性预检
try { docker version --format '{{.Server.Version}}' | Out-Null }
catch { throw 'Docker 未运行或不可达，请先启动 Docker Desktop。' }

switch ($Action) {
    'up' {
        Write-Host "▶ 构建并启动 batch-console" -ForegroundColor Cyan
        Write-Host "  端口   : http://localhost:$Port" -ForegroundColor DarkGray
        Write-Host "  后端   : $(if ($Backend) { $Backend } else { 'compose 默认 (host.docker.internal:18090)' })" -ForegroundColor DarkGray
        Write-Host "  构建模式: $BuildMode" -ForegroundColor DarkGray
        Invoke-Compose up -d --build --remove-orphans
        if ($LASTEXITCODE -ne 0) {
            # 典型场景：项目目录改名后，compose 项目名变了，但 docker-compose.yml 里
            # container_name 是固定的 'batch-console'，于是撞上旧项目遗留的同名容器。
            # 自愈：强制移除该遗留容器后重试一次。
            $stale = docker ps -aq --filter "name=^/$Container$" 2>$null
            if ($stale) {
                Write-Host "⚠ 检测到遗留同名容器 $Container，移除后重试..." -ForegroundColor Yellow
                docker rm -f $Container | Out-Null
                Invoke-Compose up -d --build --remove-orphans
            }
            if ($LASTEXITCODE -ne 0) { throw "compose up 失败（exit $LASTEXITCODE）" }
        }
        Write-Host "`n等待健康检查..." -ForegroundColor DarkGray
        $deadline = (Get-Date).AddSeconds(40)
        do {
            Start-Sleep -Seconds 2
            $h = (docker inspect --format '{{.State.Health.Status}}' $Container 2>$null)
        } while ($h -ne 'healthy' -and (Get-Date) -lt $deadline)
        if ($h -eq 'healthy') {
            Write-Host "✔ 已就绪：http://localhost:$Port" -ForegroundColor Green
        } else {
            Write-Host "⚠ 容器已启动但健康状态为 '$h'。查看日志：./scripts/deploy.ps1 logs" -ForegroundColor Yellow
        }
    }
    'build' {
        Write-Host "▶ 仅构建镜像（BuildMode=$BuildMode）" -ForegroundColor Cyan
        Invoke-Compose build
    }
    'down' {
        Write-Host "▶ 停止并移除容器" -ForegroundColor Cyan
        Invoke-Compose down
    }
    'restart' {
        Write-Host "▶ 重启容器（不重新构建）" -ForegroundColor Cyan
        Invoke-Compose restart
    }
    'logs' {
        Invoke-Compose logs -f --tail 100
    }
    'status' {
        Write-Host "▶ 容器状态" -ForegroundColor Cyan
        Invoke-Compose ps
        Write-Host "`n▶ 健康状态" -ForegroundColor Cyan
        docker inspect --format '{{.State.Health.Status}}' $Container 2>$null
        Write-Host "`n▶ 渲染后的 nginx server 配置" -ForegroundColor Cyan
        docker exec $Container cat /etc/nginx/conf.d/default.conf 2>$null
    }
    'open' {
        Start-Process "http://localhost:$Port"
    }
}
