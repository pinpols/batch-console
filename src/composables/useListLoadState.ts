import { ref } from 'vue'

/**
 * 列表 / 数据加载三态(loading + error)统一容器,消除每页都写
 * `loading=true → try {...} catch (err) { loadErr=err; throw } finally { loading=false }` 的样板。
 *
 * 用法:
 *   const { loading, error, run } = useListLoadState()
 *   async function load() {
 *     await run(async () => {
 *       const r = await api.list(...)
 *       rows.value = r.records
 *       total.value = r.total
 *     })
 *   }
 *   <ProTable :loading="loading" :error="error" :on-retry="load" ... />
 *
 * 行为:
 *  - run() 进入即清零 error,确保失败重试后不卡住"上一次错误态"
 *  - 异常仍会向上 rethrow,以便外层 runSearch / runRefresh / runReset 等能感知失败,不发成功 toast
 *  - finally 复位 loading,保证 catch 路径不会 leak loading=true
 */
export function useListLoadState() {
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (err) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}
