import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

/** 主标签栏最多平铺展示数量，其余收入左侧「更多」 */
export const PAGE_TABS_MAX_VISIBLE = 10

export interface PageTab {
  /** 逻辑页签 key：按 route.path 去重，避免 query 变化开出重复页签 */
  key: string
  /** router.push 用，保留最近一次访问的完整路径（含 query） */
  path: string
  title: string
  /** 最近访问时间，仅用于最近访问记录等辅助场景 */
  lastAccessAt: number
}

export const useTabsStore = defineStore('tabs', () => {
  const list = ref<PageTab[]>([])
  /** 主栏只展示最后打开的 N 个，新打开的固定追加在末尾 */
  const visibleTabs = computed(() => list.value.slice(-PAGE_TABS_MAX_VISIBLE))

  /** 更早打开的标签收入左侧「更多」 */
  const overflowTabs = computed(() => list.value.slice(0, -PAGE_TABS_MAX_VISIBLE))

  function addFromRoute(route: RouteLocationNormalizedLoaded) {
    if (route.path === '/login' || route.name === 'login') return

    const key = route.path
    const title = (route.meta.title as string) || String(route.name ?? '页面')
    const now = Date.now()
    const hit = list.value.find((t) => t.key === key)
    if (hit) {
      hit.title = title
      hit.path = route.fullPath
      hit.lastAccessAt = now
      return
    }
    list.value.push({ key, path: route.fullPath, title, lastAccessAt: now })
  }

  function removeByKey(key: string) {
    const i = list.value.findIndex((t) => t.key === key)
    if (i === -1) return -1
    list.value.splice(i, 1)
    return i
  }

  /** 按打开顺序（list 下标）查找 */
  function indexOfKey(key: string) {
    return list.value.findIndex((t) => t.key === key)
  }

  /**
   * 若当前路由对应标签被删掉，返回应跳转的 path；否则 null。
   * @param currentFullPath 当前 route.fullPath
   */
  function closeAllRightOf(currentFullPath: string, refKey: string): string | null {
    const i = indexOfKey(refKey)
    if (i === -1) return null
    const right = list.value.slice(i + 1)
    if (!right.length) return null
    const removed = new Set(right.map((t) => t.key))
    list.value = list.value.slice(0, i + 1)
    return removed.has(currentFullPath) ? refKey : null
  }

  function closeAllLeftOf(currentFullPath: string, refKey: string): string | null {
    const i = indexOfKey(refKey)
    if (i === -1) return null
    const left = list.value.slice(0, i)
    if (!left.length) return null
    const removed = new Set(left.map((t) => t.key))
    list.value = list.value.slice(i)
    return removed.has(currentFullPath) ? refKey : null
  }

  function closeOthers(currentFullPath: string, refKey: string): string | null {
    const kept = list.value.find((t) => t.key === refKey)
    if (!kept) return null
    const removed = list.value.filter((t) => t.key !== refKey).map((t) => t.key)
    list.value = [kept]
    return removed.includes(currentFullPath) ? refKey : null
  }

  function clear() {
    list.value = []
  }

  return {
    list,
    visibleTabs,
    overflowTabs,
    addFromRoute,
    removeByKey,
    closeAllRightOf,
    closeAllLeftOf,
    closeOthers,
    clear,
  }
})
