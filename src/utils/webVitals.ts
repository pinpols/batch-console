/**
 * Web Vitals(Core Web Vitals + 辅助指标)上报。
 *
 * 入口在 main.ts:initLogger 之后调用 initWebVitals(),把
 * LCP / CLS / INP / FCP / TTFB 通过 logRoute 上报,name 前缀 `vital:` 便于后端过滤。
 *
 * 设计选择:
 *  - 复用 logger 现有 type='route'(web-vitals 本质是页面级测量),不改后端 schema
 *  - rating(good/needs-improvement/poor)写进 props,后端可按需聚合
 *  - 仅在生产 + 有 PerformanceObserver 的环境注册,dev 环境不噪声
 *  - web-vitals 自带 dedupe/throttle,不会刷屏
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
import { logRoute } from '@/utils/logger'

function reportMetric(metric: Metric) {
  logRoute(`vital:${metric.name}`, {
    kind: 'web-vital',
    name: metric.name,
    value: Math.round(metric.value * 100) / 100,
    rating: metric.rating,
    delta: Math.round(metric.delta * 100) / 100,
    navigationType: metric.navigationType,
  })
}

export function initWebVitals(): void {
  // PerformanceObserver 缺失环境(老浏览器 / SSR)直接跳过
  if (typeof PerformanceObserver === 'undefined') return
  if (import.meta.env.DEV) return

  onCLS(reportMetric)
  onFCP(reportMetric)
  onINP(reportMetric)
  onLCP(reportMetric)
  onTTFB(reportMetric)
}
