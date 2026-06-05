import {
  ref,
  watch,
  onBeforeUnmount,
  onScopeDispose,
  getCurrentScope,
  type Ref,
  type WatchSource,
} from 'vue'
import { ElMessageBox } from 'element-plus'
import { i18n } from '@/locales'

/**
 * 脏数据保护:
 *  - 跟踪一个 reactive form 与基线快照的差异 → `isDirty`
 *  - 窗口 `beforeunload` 警告(浏览器刷新 / 关 tab)
 *  - 提供 `confirmDiscard()` 给 `:before-close` 用,弹"未保存的修改将丢失"确认
 *  - 提供 `markPristine()` 在打开 / 保存后重置基线
 *
 * 用法:
 *   const dirty = useDirtyForm(() => createForm, { enabled: () => createDrawerVisible.value })
 *
 *   function openCreate() {
 *     resetCreateForm()
 *     dirty.markPristine()
 *     createDrawerVisible.value = true
 *   }
 *
 *   async function onCreateDrawerClose(done: () => void) {
 *     if (createSaving.value) return
 *     if (!(await dirty.confirmDiscard())) return
 *     done()
 *   }
 *
 *   async function submitCreate() {
 *     ...
 *     dirty.markPristine()  // 保存成功后,关闭流程不再弹 confirm
 *     createDrawerVisible.value = false
 *   }
 */
export interface UseDirtyFormOptions {
  /** 启用窗口卸载警告(默认 true) */
  warnOnUnload?: boolean
  /** 启用条件:抽屉/弹窗 visible 时才挂载 beforeunload。默认始终启用 */
  enabled?: () => boolean
  /** 自定义 confirm 文案(i18n key 优先) */
  confirmTitle?: string
  confirmMessage?: string
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }
  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) {
      return false
    }
  }
  return true
}

export function useDirtyForm<T>(
  source: WatchSource<T> | Ref<T>,
  options: UseDirtyFormOptions = {},
) {
  const { warnOnUnload = true, enabled, confirmTitle, confirmMessage } = options

  const baseline = ref<T | null>(null)
  const isDirty = ref(false)

  function readCurrent(): T {
    if (typeof source === 'function') {
      return (source as () => T)()
    }
    return (source as Ref<T>).value
  }

  function markPristine() {
    baseline.value = deepClone(readCurrent()) as T
    isDirty.value = false
  }

  function recompute() {
    if (baseline.value == null) {
      // 未初始化基线,默认不脏
      isDirty.value = false
      return
    }
    isDirty.value = !deepEqual(readCurrent(), baseline.value)
  }

  // 初始基线 = 挂载时当前快照
  markPristine()

  watch(source as WatchSource<T>, recompute, { deep: true })

  function isActive(): boolean {
    if (!enabled) return true
    try {
      return enabled() !== false
    } catch {
      return true
    }
  }

  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!isActive()) return
    if (!isDirty.value) return
    e.preventDefault()
    // 现代浏览器忽略自定义文案,但仍需 returnValue 触发原生提示
    e.returnValue = ''
  }

  if (warnOnUnload && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
    const cleanup = () => window.removeEventListener('beforeunload', onBeforeUnload)
    // 组件内挂 onBeforeUnmount,纯 effectScope(单测/工具)挂 onScopeDispose,兜底两路
    if (getCurrentScope()) {
      onScopeDispose(cleanup)
    } else {
      onBeforeUnmount(cleanup)
    }
  }

  /**
   * 用于 el-dialog/el-drawer 的 `:before-close` 拦截。
   * - 表单未脏 → resolve(true) 直接关
   * - 已脏 → 弹 confirm,用户确认丢弃 → resolve(true);取消 → resolve(false)
   */
  async function confirmDiscard(): Promise<boolean> {
    if (!isDirty.value) return true
    const t = i18n.global.t
    const title = confirmTitle ?? t('dirtyForm.confirmTitle')
    const message = confirmMessage ?? t('dirtyForm.confirmMessage')
    const confirmText = t('dirtyForm.confirmDiscard')
    const cancelText = t('dirtyForm.cancelDiscard')
    try {
      await ElMessageBox.confirm(message, title, {
        type: 'warning',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        // 点遮罩不算确认放弃,必须显式选
        closeOnClickModal: false,
        closeOnPressEscape: true,
      })
      return true
    } catch {
      return false
    }
  }

  return {
    isDirty,
    markPristine,
    confirmDiscard,
  }
}
