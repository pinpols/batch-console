import { computed, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useBriefActionLoading } from '@/composables/useBriefActionLoading'

/**
 * 列表页「纯前端筛选 / 本地分页」统一反馈：表格 loading + 查询/重置 Toast。
 * 远端请求 loading 由调用方传入，会与本地 filterBusy 合并为 tableBlocking。
 */
export function useListFilterFeedback(remoteLoading: Ref<boolean>) {
  const { busy: filterBusy, run } = useBriefActionLoading()
  const tableBlocking = computed(() => remoteLoading.value || filterBusy.value)

  async function runSearch(fn: () => void | Promise<void>) {
    await run(async () => {
      await Promise.resolve(fn())
    })
    ElMessage.success({ message: '已按条件更新列表', duration: 1400 })
  }

  async function runReset(fn: () => void | Promise<void>) {
    await run(async () => {
      await Promise.resolve(fn())
    })
    ElMessage.success({ message: '已重置筛选条件', duration: 1400 })
  }

  return { filterBusy, tableBlocking, runSearch, runReset }
}
