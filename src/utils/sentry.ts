/**
 * Sentry 错误监控初始化。DSN 未配置时保持关闭。
 *
 * 激活步骤（按顺序）：
 *   1. `.env.production` 或发布构建环境配置 `VITE_SENTRY_DSN=https://...`
 *   2. 部署时确认 Sentry release 与 `version.json` 中的版本和 gitSha 对齐
 *   3. CI 上传同一 release 的 sourcemap；没有上传时不得开启生产告警闭环
 *
 * 当前两个 .env 的 DSN 都为空 → `initSentry` 第一行 early return → 整个路径 zero-cost。
 * SDK 已作为运行时依赖安装；动态 import 仅用于 DSN 为空时避免初始化开销。
 */

import type { App } from 'vue'
import type { Router } from 'vue-router'
import { STORAGE_KEYS } from '@/constants/storageKeys'

export interface SentryOptions {
  app: App
  router: Router
  dsn?: string
}

/**
 * 初始化 Sentry。DSN 为空时不加载 SDK，零开销。
 * 动态 import 确保无 DSN 时不增加 bundle 体积。
 */
export async function initSentry({ app, router, dsn }: SentryOptions): Promise<void> {
  if (!dsn) return

  // 使用变量拼接模块名，避免 Rollup 对未安装的 @sentry/vue 做静态解析报错
  const pkg = '@sentry/vue'
  const Sentry = await import(/* @vite-ignore */ pkg)

  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.MODE,
    release: __APP_VERSION__,

    integrations: [Sentry.browserTracingIntegration({ router })],

    // 采样率 — 生产建议 0.1~0.3，开发可以 1.0
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,

    // 只采集同源和 CDN 的异常，过滤浏览器插件噪音
    allowUrls: [location.origin],

    // 过滤常见无意义异常
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      /Loading chunk .* failed/,
      /NetworkError/,
    ],

    beforeSend(event: Record<string, unknown>) {
      // 附加租户信息
      const tenantId = localStorage.getItem(STORAGE_KEYS.tenantId)
      if (tenantId) {
        event.tags = { ...(event.tags as Record<string, string> | undefined), tenantId }
      }
      return event
    },
  })
}

/**
 * 全局定义，由 vite.config.ts 中 define 注入。
 * 若未配置则回退为 'unknown'。
 */
declare const __APP_VERSION__: string
