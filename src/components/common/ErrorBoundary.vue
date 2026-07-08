<template>
  <EmptyState v-if="error" variant="error" :title="t('error.boundary')" :description="errorText">
    <template #action>
      <el-button type="primary" :icon="Refresh" @click="retry">{{ t('common.refresh') }}</el-button>
      <el-button :icon="HomeFilled" @click="goHome">{{ t('common.backToHome') }}</el-button>
    </template>
  </EmptyState>
  <slot v-else />
</template>

<script setup lang="ts">
  /**
   * 路由级错误边界:子组件渲染 / setup 抛错时捕获并降级到错误态,
   * 避免单个 view 挂掉带翻整个 SPA。
   *
   * Vue 3 onErrorCaptured 返回 false 阻止异常向上冒泡;同时通过 logError
   * 上报,Sentry / 后端 telemetry 都能拿到。
   *
   * 用法:在 router-view 外层包一层
   *   <ErrorBoundary :route-key="route.fullPath">
   *     <RouterView ... />
   *   </ErrorBoundary>
   *
   * route-key 变化时自动 reset(用户切到别页就清空错误态)。
   */
  import { ref, onErrorCaptured, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh, House as HomeFilled } from 'lucide-vue-next'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { logError } from '@/utils/logger'

  const props = defineProps<{
    /** 切换 key(通常是 route.fullPath)时自动 reset 错误态 */
    routeKey?: string
  }>()

  const router = useRouter()
  const { t } = useI18n({ useScope: 'global' })
  const error = ref<unknown>(null)

  const errorText = ref('')

  /**
   * 是否为 API / 网络错误(axios)。这类错误应由各页自身的 loadError / 空态 / toast 处理,
   * 不该让整个路由降级成「组件渲染异常」—— 否则加载期一个 4xx(如 admin 未选租户的
   * 「租户参数缺失」、无权角色的 403)就会把整页打崩。仅真正的渲染 / 逻辑异常才进错误态边界。
   */
  function isApiError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const e = err as Record<string, unknown>
    if (e.isAxiosError === true) return true
    if ('response' in e && 'config' in e) return true
    return (
      typeof e.message === 'string' &&
      /Request failed with status code|Network Error|timeout of \d+ms exceeded/i.test(e.message)
    )
  }

  onErrorCaptured((err, instance, info) => {
    const message = err instanceof Error ? err.message : String(err)
    if (isApiError(err)) {
      // 记录后吞掉(返回 false 阻止冒泡),但不切换到错误态:页面保持自身渲染,
      // 由其 loadError / EmptyState 或拦截器 toast 呈现失败,避免整页「组件渲染异常」。
      logError(`ErrorBoundary(api-non-fatal):${message}`, {
        kind: 'errorBoundary',
        info,
        message,
        component: instance?.$options?.name || instance?.$options?.__name || 'Unknown',
      })
      return false
    }
    error.value = err
    errorText.value = `${message}(${info})`
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined
    logError(`ErrorBoundary:${message}`, {
      kind: 'errorBoundary',
      info,
      message,
      stack,
      component: instance?.$options?.name || instance?.$options?.__name || 'Unknown',
    })
    return false // 阻止向上冒泡,避免污染全局 errorHandler 二次记录
  })

  watch(
    () => props.routeKey,
    () => {
      error.value = null
      errorText.value = ''
    },
  )

  function retry() {
    error.value = null
    errorText.value = ''
    // 强制重渲染由 routeKey 变化触发,这里只清状态;若需强行重挂,父组件 :key 控制
  }

  function goHome() {
    error.value = null
    void router.push('/')
  }
</script>
