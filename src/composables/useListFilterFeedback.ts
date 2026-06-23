import { computed, type Component, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft, Refresh } from '@element-plus/icons-vue'
import { useBriefActionLoading } from '@/composables/useBriefActionLoading'
import { i18n } from '@/locales'

/**
 * 列表页「查询 / 重置 / 刷新」统一交互反馈:
 *   - 按钮 loading 闪烁(useBriefActionLoading,~300ms 最低显示)
 *   - 完成后 1.4s ElMessage plain toast,三种动作各自图标 + 颜色
 *   - grouping: true 防止快速连点堆叠(同消息合并为 ×N)
 *   - 表格 v-loading 由 tableBlocking 合并 remoteLoading + filterBusy 提供
 *
 * 远端请求的 loading ref 由调用方传入(ProTable / TanStack Query 的 isFetching 等)。
 *
 * 三个 run* 都 throw-safe:即使内部 fn 抛错也不会卡 filterBusy,但**不会发成功 toast**。
 */
export function useListFilterFeedback(remoteLoading: Ref<boolean>) {
  const { busy: filterBusy, run } = useBriefActionLoading()
  const tableBlocking = computed(() => remoteLoading.value || filterBusy.value)

  async function runWith(
    fn: () => void | Promise<void>,
    successMsg: string,
    icon: Component,
    type: 'success' | 'info',
  ) {
    let ok = false
    try {
      await run(async () => {
        await Promise.resolve(fn())
      })
      ok = true
    } finally {
      if (ok) {
        ElMessage({
          message: successMsg,
          type,
          icon,
          duration: 1400,
          plain: true,
          grouping: true,
          customClass: 'filter-feedback-toast',
        })
      }
    }
  }

  function runSearch(fn: () => void | Promise<void>) {
    return runWith(fn, i18n.global.t('commonAction.listUpdatedByFilter'), Search, 'success')
  }

  function runReset(fn: () => void | Promise<void>) {
    return runWith(fn, i18n.global.t('commonAction.filterReset'), RefreshLeft, 'info')
  }

  function runRefresh(fn: () => void | Promise<void>) {
    return runWith(fn, i18n.global.t('commonAction.refreshed'), Refresh, 'success')
  }

  return { filterBusy, tableBlocking, runSearch, runReset, runRefresh }
}
