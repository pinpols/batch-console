import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { RefreshCw as Refresh } from 'lucide-vue-next'
import { i18n } from '@/locales'

/**
 * 「刷新」按钮统一交互反馈(用于不走 ListPageQueryBar 的独立 PageHeader 刷新按钮)。
 *
 * - `loading`:ref<boolean>,直接绑 `:loading` 给按钮显示 spinner
 * - `run(fn)`:执行 fn,完成后 plain toast「已刷新」;失败 toast 红色错误
 * - 防快速连点:in-flight 时再次调用直接忽略
 *
 * 用法:
 *   const { loading, run } = useRefreshAction()
 *   <el-button :loading="loading" @click="run(load)">刷新</el-button>
 */
export function useRefreshAction(): {
  loading: Ref<boolean>
  run: (fn: () => void | Promise<void>) => Promise<void>
} {
  const loading = ref(false)

  async function run(fn: () => void | Promise<void>) {
    if (loading.value) return
    loading.value = true
    const start = Date.now()
    let ok = false
    try {
      await Promise.resolve(fn())
      ok = true
    } catch (e) {
      ElMessage({
        message: i18n.global.t('commonAction.refreshFailed'),
        type: 'error',
        icon: Refresh,
        duration: 2400,
        plain: true,
        customClass: 'filter-feedback-toast',
      })
      throw e
    } finally {
      // 最少 280ms 显示 loading,避免极快的请求让按钮"没反应"
      const elapsed = Date.now() - start
      if (elapsed < 280) await new Promise((r) => setTimeout(r, 280 - elapsed))
      loading.value = false
      if (ok) {
        ElMessage({
          message: i18n.global.t('commonAction.refreshed'),
          type: 'success',
          icon: Refresh,
          duration: 1400,
          plain: true,
          grouping: true,
          customClass: 'filter-feedback-toast',
        })
      }
    }
  }

  return { loading, run }
}
