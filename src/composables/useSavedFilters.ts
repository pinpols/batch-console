import { ref, type Ref } from 'vue'

/** 一组已保存的筛选条件(对应某个列表页的一套 query 快照)。 */
export interface SavedFilterSet<T> {
  id: string
  name: string
  filters: T
  createdAt: number
}

export interface UseSavedFiltersOptions<T> {
  /** 列表页唯一标识(通常用 route.path 或显式短名),决定 localStorage 分桶。 */
  pageKey: string
  /** 取当前筛选条件快照(会被深拷贝存储)。 */
  getCurrent: () => T
  /** 应用一组筛选条件到当前页(由调用方写回各 ref/reactive)。 */
  apply: (filters: T) => void
  /** 可选:当前用户标识,用于按用户隔离;不传则用 'anon'。 */
  userId?: () => string | undefined
}

export interface UseSavedFiltersHandle<T> {
  /** 当前页已保存的筛选集(响应式,按 createdAt 倒序)。 */
  sets: Ref<SavedFilterSet<T>[]>
  /** 以当前筛选条件保存为一组,返回新建的集合;name 为空或重名(覆盖)处理。 */
  save: (name: string) => SavedFilterSet<T> | null
  /** 应用指定集合的筛选条件;找不到则忽略。 */
  applySet: (id: string) => void
  /** 删除指定集合。 */
  remove: (id: string) => void
  /** 重命名指定集合。 */
  rename: (id: string, name: string) => void
  /** 导出当前页全部集合为 JSON 字符串(便于跨环境/分享)。 */
  exportSets: () => string
  /** 从 JSON 字符串导入集合(追加,跳过解析失败),返回成功导入条数。 */
  importSets: (json: string) => number
}

const STORAGE_PREFIX = 'bc:saved-filters'

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* crypto 不可用 — 退回时间戳 */
  }
  return `sf_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

/** 深拷贝快照,避免存进去的对象与页面 reactive 共享引用导致后续被改写。 */
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * 列表页「保存的筛选器」。客户端实现(localStorage,按 用户 + 页面 分桶),
 * 无需后端用户偏好接口。适配 ListPageQueryBar 的 #prepend 槽 + SavedFiltersMenu。
 *
 * 关键设计:
 * - 存储 key = `bc:saved-filters:{userId|anon}:{pageKey}`,换用户/换页天然隔离。
 * - 存取均深拷贝,杜绝与页面 reactive 共享引用。
 * - localStorage 不可用(隐身/配额)时静默降级:内存态仍可用,只是不持久化。
 */
export function useSavedFilters<T extends Record<string, unknown>>(
  options: UseSavedFiltersOptions<T>,
): UseSavedFiltersHandle<T> {
  const { pageKey, getCurrent, apply, userId } = options

  function storageKey(): string {
    const uid = userId?.() || 'anon'
    return `${STORAGE_PREFIX}:${uid}:${pageKey}`
  }

  function read(): SavedFilterSet<T>[] {
    try {
      const raw = localStorage.getItem(storageKey())
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (s): s is SavedFilterSet<T> =>
          s && typeof s.id === 'string' && typeof s.name === 'string' && 'filters' in s,
      )
    } catch {
      // 损坏的 JSON / localStorage 不可用 — 视为空集
      return []
    }
  }

  function write(list: SavedFilterSet<T>[]) {
    sets.value = [...list].sort((a, b) => b.createdAt - a.createdAt)
    try {
      localStorage.setItem(storageKey(), JSON.stringify(sets.value))
    } catch {
      // 配额/隐身模式:保留内存态,不持久化
    }
  }

  const sets = ref(read().sort((a, b) => b.createdAt - a.createdAt)) as Ref<SavedFilterSet<T>[]>

  function save(name: string): SavedFilterSet<T> | null {
    const trimmed = name.trim()
    if (!trimmed) return null
    const filters = snapshot(getCurrent())
    const existing = sets.value.find((s) => s.name === trimmed)
    if (existing) {
      // 同名覆盖:更新 filters + 刷新时间戳(置顶)
      const updated: SavedFilterSet<T> = { ...existing, filters, createdAt: Date.now() }
      write(sets.value.map((s) => (s.id === existing.id ? updated : s)))
      return updated
    }
    const created: SavedFilterSet<T> = {
      id: genId(),
      name: trimmed,
      filters,
      createdAt: Date.now(),
    }
    write([...sets.value, created])
    return created
  }

  function applySet(id: string) {
    const target = sets.value.find((s) => s.id === id)
    if (!target) return
    apply(snapshot(target.filters))
  }

  function remove(id: string) {
    write(sets.value.filter((s) => s.id !== id))
  }

  function rename(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    write(sets.value.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
  }

  function exportSets(): string {
    return JSON.stringify(sets.value, null, 2)
  }

  function importSets(json: string): number {
    let incoming: unknown
    try {
      incoming = JSON.parse(json)
    } catch {
      return 0
    }
    if (!Array.isArray(incoming)) return 0
    const valid = incoming.filter(
      (s): s is SavedFilterSet<T> =>
        s && typeof s.name === 'string' && 'filters' in s && typeof s.filters === 'object',
    )
    if (!valid.length) return 0
    // 重新分配 id + 时间戳,避免与现有冲突
    const now = Date.now()
    const normalized = valid.map((s, i) => ({
      id: genId(),
      name: String(s.name).trim() || `import-${i + 1}`,
      filters: s.filters,
      createdAt: now + i,
    }))
    write([...sets.value, ...normalized])
    return normalized.length
  }

  return { sets, save, applySet, remove, rename, exportSets, importSets }
}
