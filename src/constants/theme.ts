export const THEME_STORAGE_KEY = 'batch-console:theme'

/** 实际应用到页面的明暗值 */
export type ThemeMode = 'light' | 'dark'

/** 用户选择：固定浅色 / 固定深色 / 跟随系统 */
export type ThemePreference = ThemeMode | 'system'

export type ApplyThemeOptions = {
  /**
   * 使用 View Transitions API 做整页过渡（不支持或用户开启「减少动效」时回退为瞬切）
   */
  viewTransition?: boolean
}

export function getSystemIsDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 读本地存储；无记录时按 redesign 默认深色 */
export function readThemePreference(): ThemePreference {
  const v = localStorage.getItem(THEME_STORAGE_KEY)
  if (v === 'dark' || v === 'light' || v === 'system') return v
  return 'dark'
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemIsDark: boolean,
): ThemeMode {
  if (preference === 'light') return 'light'
  if (preference === 'dark') return 'dark'
  return systemIsDark ? 'dark' : 'light'
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

export function applyThemeToDocument(mode: ThemeMode, options?: ApplyThemeOptions): void {
  const apply = () => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }

  const useVt = options?.viewTransition === true && !prefersReducedMotion()
  const startVt = document.startViewTransition?.bind(document)

  if (!useVt || typeof startVt !== 'function') {
    apply()
    return
  }

  startVt(apply)
}
