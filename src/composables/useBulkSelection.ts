import { computed, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { i18n } from '@/locales'

/**
 * 列表批量选择 + 批量执行。配合 ProTable 的 `<el-table-column type="selection">` +
 * `@selection-change="onSelectionChange"` 使用;批量动作栏用 `count`/`selected` 渲染。
 *
 * 设计:
 * - 批量动作走「客户端逐项调单项 API」(无需后端批量端点),限并发(默认 4)防打爆;
 *   逐项收集成功/失败,结束弹一条汇总(n 成功 / m 失败,失败保留可重试),**部分失败不静默**。
 * - `runBulk` 返回 {ok, fail, errors},调用方可据此决定是否 reload / 保留选中。
 * - `bindTable(proTableRef)`:批量完成后调 ProTable 暴露的 clearSelection() 清掉勾选态。
 */
export interface BulkRunResult<T> {
  ok: number
  fail: number
  failed: Array<{ item: T; error: unknown }>
}

export interface BulkRunOptions {
  /** 并发上限(默认 4) */
  concurrency?: number
  /** 成功后是否清空选择(默认 true) */
  clearOnDone?: boolean
  /** 自定义汇总文案前缀(如「重试」),默认「操作」 */
  actionLabel?: string
}

interface ProTableExpose {
  clearSelection?: () => void
}

export function useBulkSelection<T = Record<string, unknown>>() {
  const selected = shallowRef<T[]>([])
  const running = ref(false)
  const count = computed(() => selected.value.length)
  const hasSelection = computed(() => count.value > 0)

  const tableRef = ref<ProTableExpose | null>(null)
  function bindTable(r: ProTableExpose | null) {
    tableRef.value = r
  }

  function onSelectionChange(rows: T[]) {
    selected.value = [...rows]
  }

  function clear() {
    selected.value = []
    tableRef.value?.clearSelection?.()
  }

  async function runBulk(
    items: T[],
    action: (item: T) => Promise<unknown>,
    opts: BulkRunOptions = {},
  ): Promise<BulkRunResult<T>> {
    const result: BulkRunResult<T> = { ok: 0, fail: 0, failed: [] }
    if (!items.length || running.value) return result
    const t = i18n.global.t
    const label = opts.actionLabel || t('bulk.actionDefault')
    const concurrency = Math.max(1, opts.concurrency ?? 4)
    running.value = true
    try {
      let cursor = 0
      const worker = async () => {
        while (cursor < items.length) {
          const item = items[cursor++]
          try {
            await action(item)
            result.ok++
          } catch (error) {
            result.fail++
            result.failed.push({ item, error })
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))

      if (result.fail === 0) {
        ElMessage.success(t('bulk.allSucceeded', { label, n: result.ok }))
        if (opts.clearOnDone !== false) clear()
      } else if (result.ok === 0) {
        ElMessage.error(t('bulk.allFailed', { label, n: result.fail }))
      } else {
        ElMessage.warning(t('bulk.partial', { label, ok: result.ok, fail: result.fail }))
      }
    } finally {
      running.value = false
    }
    return result
  }

  return { selected, count, hasSelection, running, onSelectionChange, clear, bindTable, runBulk }
}
