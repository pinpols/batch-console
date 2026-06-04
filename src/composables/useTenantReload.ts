import { watch } from 'vue'
import { useTenantStore } from '@/stores/tenant'
import { logError } from '@/utils/logger'

/**
 * 在组件 setup 时调用 `fn` 一次，并在 `tenant.tenantId` 变化时再次调用。
 *
 * 统一"切换租户后需要重取数据"的模式，替代各视图里手写的
 * `onMounted(load)` + `watch(() => tenant.tenantId, load)`，避免漏写
 * watch 造成切租户后数据不刷新的 bug（典型如 OpsSummary）。
 *
 * 使用 TanStack Query 且已把 tenantId 纳入 queryKey 的场景无需此组合式
 * （查询会自动失效重取）。
 */
export function useTenantReload(fn: () => void | Promise<void>): void {
  const tenant = useTenantStore()
  watch(
    () => tenant.tenantId,
    (tenantId) => {
      // 无当前租户(典型:admin 登录后尚未选择租户)时不触发加载。租户依赖视图若用空
      // tenantId 发请求,BE 会拒为 400「租户参数缺失」,未捕获的异常冒泡会让整页崩成
      // 「组件渲染异常」。等租户选定后,本 watch 会以非空值再次触发加载。
      if (!tenantId) return
      // 同步调用 fn(保持原有「setup 即触发」时序),并兜底捕获同步抛错与异步 rejection:
      // 页面 load() 若漏 catch,这里记录而非让异常逸出(unhandledrejection / 触发错误边界)。
      // 各页仍应自行 catch 设 loadError 呈现失败态,这里只是安全网(记录,不静默吞)。
      const onErr = (e: unknown) =>
        logError(`useTenantReload load failed: ${e instanceof Error ? e.message : String(e)}`, {
          kind: 'tenantReload',
        })
      try {
        const ret = fn()
        if (ret && typeof (ret as Promise<void>).then === 'function') {
          ;(ret as Promise<void>).catch(onErr)
        }
      } catch (e) {
        onErr(e)
      }
    },
    { immediate: true },
  )
}
