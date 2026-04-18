import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { ElSelect } from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import {
  applyThemeToDocument,
  getSystemIsDark,
  readThemePreference,
  resolveEffectiveTheme,
} from '@/constants/theme'
import { applyContentDensityToDocument, readStoredContentDensity } from '@/constants/contentDensity'
import App from './App.vue'

applyThemeToDocument(resolveEffectiveTheme(readThemePreference(), getSystemIsDark()))
applyContentDensityToDocument(readStoredContentDensity())
import router from './router'
import { permissionDirective } from '@/directives/permission'
import { hoverTabActivateDirective } from '@/directives/hoverTabActivate'
import { trackClickDirective } from '@/directives/trackClick'
import { safeHtmlDirective } from '@/directives/safeHtml'
import { initLogger, logClick, logError } from '@/utils/logger'
import { initSentry } from '@/utils/sentry'
import '@/charts/echarts'
import '@/styles/app.css'

/** 下拉面板与选择框同宽（默认仅用 minWidth，弹层常宽于触发器） */
const selectProps = ElSelect.props as Record<string, unknown> | undefined
if (selectProps) {
  selectProps.fitInputWidth = { type: Boolean, default: true }
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s 内不重复请求
        gcTime: 5 * 60_000, // 5min 后清理未使用的缓存
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  },
})
app.directive('permission', permissionDirective)
app.directive('hover-tab-activate', hoverTabActivateDirective)
app.directive('track-click', trackClickDirective)
app.directive('safe-html', safeHtmlDirective)

// ---- 前端操作日志系统（本地 buffer + localStorage 兜底 + 批量上报 /api/console/telemetry/events） ----
initLogger()

// ---- Sentry 错误监控 ----
initSentry({
  app,
  router,
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

// Vue 组件内未捕获异常 → 记录组件名、info、message、stack(前 5 行)供前后端联调
app.config.errorHandler = (err, instance, info) => {
  const component = instance?.$options?.name || instance?.$options?.__name || 'Unknown'
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined
  logError(`Vue 异常:${component} [${info}]`, {
    kind: 'vue',
    component,
    info,
    message,
    stack,
  })
}

// 全局 JS 运行时异常
window.addEventListener('error', (event) => {
  logError(`运行时异常:${event.message}`, {
    kind: 'runtime',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  })
})

// 未处理的 Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack =
    reason instanceof Error ? reason.stack?.split('\n').slice(0, 5).join('\n') : undefined
  logError(`未处理 Promise 异常:${message}`, {
    kind: 'unhandled-rejection',
    message,
    stack,
  })
})

// 全局按钮点击自动采集（事件委托，无需每个按钮加指令）
document.addEventListener(
  'click',
  (e) => {
    const el = (e.target as HTMLElement)?.closest?.(
      'button, .el-button, [role="button"], a.el-menu-item',
    ) as HTMLElement | null
    if (!el) return
    // 已被 v-track-click 处理的跳过
    if ((el as HTMLElement & { __trackClick?: unknown }).__trackClick) return
    const text =
      el.getAttribute('aria-label') ||
      el.textContent?.trim().slice(0, 40) ||
      el.className.split(' ')[0] ||
      'button'
    logClick(text)
  },
  true,
)

app.mount('#app')
