/**
 * Sentry 错误监控初始化
 *
 * 依赖 @sentry/vue，需先安装：npm install @sentry/vue
 * 通过环境变量 VITE_SENTRY_DSN 控制是否启用
 *
 * 未安装 @sentry/vue 时 build 不报错（动态路径跳过 Rollup 静态分析）
 */

import type { App } from 'vue'
import type { Router } from 'vue-router'

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
      const tenantId = localStorage.getItem('batch-console-tenant-id')
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
