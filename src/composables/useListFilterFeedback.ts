import { computed, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useBriefActionLoading } from '@/composables/useBriefActionLoading'

/**
 * 列表页「查询 / 重置 / 刷新」统一交互反馈:
 *   - 按钮 loading 闪烁(useBriefActionLoading,~300ms 最低显示)
 *   - 完成后 1.4s ElMessage toast
 *   - 表格 v-loading 由 tableBlocking 合并 remoteLoading + filterBusy 提供
 *
 * 远端请求的 loading ref 由调用方传入(ProTable / TanStack Query 的 isFetching 等)。
 *
 * 三个 run* 都 throw-safe:即使内部 fn 抛错也不会卡 filterBusy,但**不会发成功 toast**。
 */
export function useListFilterFeedback(remoteLoading: Ref<boolean>) {
  const { busy: filterBusy, run } = useBriefActionLoading()
  const tableBlocking = computed(() => remoteLoading.value || filterBusy.value)

  async function runWith(fn: () => void | Promise<void>, successMsg: string) {
    let ok = false
    try {
      await run(async () => {
        await Promise.resolve(fn())
      })
      ok = true
    } finally {
      if (ok) ElMessage.success({ message: successMsg, duration: 1400 })
    }
  }

  function runSearch(fn: () => void | Promise<void>) {
    return runWith(fn, '已按条件更新列表')
  }

  function runReset(fn: () => void | Promise<void>) {
    return runWith(fn, '已重置筛选条件')
  }

  function runRefresh(fn: () => void | Promise<void>) {
    return runWith(fn, '已刷新')
  }

  return { filterBusy, tableBlocking, runSearch, runReset, runRefresh }
}
