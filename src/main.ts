import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus, { ElSelect } from 'element-plus'
import 'element-plus/dist/index.css'
import { i18n } from '@/locales'
import { resolveElementPlusLocale } from '@/locales/elementPlus'
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
import { useAuthStore } from '@/stores/auth'
import { permissionDirective } from '@/directives/permission'
import { hoverTabActivateDirective } from '@/directives/hoverTabActivate'
import { trackClickDirective } from '@/directives/trackClick'
import { safeHtmlDirective } from '@/directives/safeHtml'
import { initLogger, logClick, logError } from '@/utils/logger'
import { initSentry } from '@/utils/sentry'
import { initWebVitals } from '@/utils/webVitals'
// echarts 初始化挪到 OpsSummary.vue 顶部 import,跟随路由 lazy chunk 加载,
// 不进首屏。非运维页用户(配置员/审批员等)少下 ~181 KB gzip。
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

// 预热 /auth/me，避免“刷新页面后首次点菜单”被路由守卫阻塞导致体感卡顿
{
  const auth = useAuthStore(pinia)
  if (auth.isLoggedIn && !auth.userInfo) {
    auth.fetchMe().catch(() => auth.logout())
  }
}
app.use(i18n)
// Element Plus imperative API(ElMessageBox / ElNotification / ElMessage)依赖全局 locale。
// 声明式组件由 App.vue 的 ElConfigProvider 响应式覆盖,这里只设置初始值。
app.use(ElementPlus, { locale: resolveElementPlusLocale(i18n.global.locale.value) })
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

// ---- Web Vitals(LCP / CLS / INP / FCP / TTFB)→ logger,生产环境用,给后续优化建测量基线 ----
initWebVitals()

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
