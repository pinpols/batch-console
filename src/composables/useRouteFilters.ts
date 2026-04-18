import { watch, reactive, onMounted, type UnwrapRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * 将筛选条件双向同步到 URL query params。
 * - 页面初始化时从 URL 恢复筛选值
 * - 筛选值变化时自动更新 URL（replace，不产生历史记录）
 * - 从详情页返回时筛选条件不丢失
 *
 * @param defaults 筛选字段的默认值（也作为类型推导）
 * @returns reactive filters 对象 + resetFilters 方法
 */
export function useRouteFilters<T extends Record<string, string | number | boolean | undefined>>(
  defaults: T,
) {
  const route = useRoute()
  const router = useRouter()

  const filters = reactive({ ...defaults }) as UnwrapRef<T>

  function parseValue(
    key: keyof T,
    raw: string | undefined,
  ): string | number | boolean | undefined {
    if (raw === undefined || raw === '') return defaults[key]
    const def = defaults[key]
    if (typeof def === 'boolean') return raw === 'true'
    if (typeof def === 'number') {
      const n = Number(raw)
      return Number.isFinite(n) ? n : def
    }
    return raw
  }

  function loadFromRoute() {
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const raw = route.query[key as string]
      const val = parseValue(key, typeof raw === 'string' ? raw : undefined)
      ;(filters as Record<string, unknown>)[key as string] = val
    }
  }

  function syncToRoute() {
    const query: Record<string, string> = {}
    // 保留非筛选类 query params
    for (const [k, v] of Object.entries(route.query)) {
      if (!(k in defaults) && typeof v === 'string') {
        query[k] = v
      }
    }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const val = (filters as Record<string, unknown>)[key as string]
      if (val !== undefined && val !== '' && val !== defaults[key]) {
        query[key as string] = String(val)
      }
    }
    void router.replace({ query })
  }

  function resetFilters() {
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      ;(filters as Record<string, unknown>)[key as string] = defaults[key]
    }
  }

  onMounted(loadFromRoute)

  watch(filters, syncToRoute, { deep: true })

  return { filters, resetFilters, loadFromRoute }
}
