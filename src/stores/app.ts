import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  applyThemeToDocument,
  getSystemIsDark,
  readThemePreference,
  resolveEffectiveTheme,
  THEME_STORAGE_KEY,
  type ThemeMode,
  type ThemePreference,
} from '@/constants/theme'
import {
  applyContentDensityToDocument,
  CONTENT_DENSITY_STORAGE_KEY,
  type ContentDensityMode,
} from '@/constants/contentDensity'

const sidebarCollapsedKey = 'batch-console:sidebar-collapsed'
const focusModeKey = 'batch-console:focus-mode'

export type ContentDensity = ContentDensityMode

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(localStorage.getItem(sidebarCollapsedKey) === '1')
  const contentDensity = ref<ContentDensity>(
    (localStorage.getItem(CONTENT_DENSITY_STORAGE_KEY) as ContentDensity | null) ?? 'comfortable',
  )
  const themePreference = ref<ThemePreference>(readThemePreference())
  const systemIsDark = ref(getSystemIsDark())
  /** 实际明暗（随 themePreference + 系统偏好变化） */
  const theme = computed(() => resolveEffectiveTheme(themePreference.value, systemIsDark.value))

  let systemMqCleanup: (() => void) | null = null

  function bindSystemColorSchemeListener() {
    systemMqCleanup?.()
    systemMqCleanup = null
    if (typeof window === 'undefined') return
    if (themePreference.value !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSchemeChange = () => {
      systemIsDark.value = mq.matches
    }
    mq.addEventListener('change', onSchemeChange)
    systemMqCleanup = () => mq.removeEventListener('change', onSchemeChange)
  }

  const focusMode = ref(localStorage.getItem(focusModeKey) === '1')

  const contentPadding = computed(() => (contentDensity.value === 'compact' ? 16 : 24))

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setSidebarCollapsed(value: boolean) {
    sidebarCollapsed.value = value
  }

  function setContentDensity(value: ContentDensity) {
    contentDensity.value = value
  }

  /** 固定为浅色或深色（退出「跟随系统」） */
  function setTheme(value: ThemeMode) {
    themePreference.value = value
  }

  function setThemePreference(value: ThemePreference) {
    themePreference.value = value
  }

  /** 跟随系统 → 浅色 → 深色 → … 循环 */
  function toggleTheme() {
    const cycle: ThemePreference[] = ['system', 'light', 'dark']
    const i = cycle.indexOf(themePreference.value)
    themePreference.value = cycle[(i + 1) % cycle.length]
  }

  function setFocusMode(value: boolean) {
    focusMode.value = value
  }

  function toggleFocusMode() {
    focusMode.value = !focusMode.value
  }

  watch(sidebarCollapsed, (value) => {
    localStorage.setItem(sidebarCollapsedKey, value ? '1' : '0')
  })

  watch(
    contentDensity,
    (value) => {
      localStorage.setItem(CONTENT_DENSITY_STORAGE_KEY, value)
      applyContentDensityToDocument(value)
    },
    { immediate: true },
  )

  watch(
    themePreference,
    (p) => {
      localStorage.setItem(THEME_STORAGE_KEY, p)
      if (p === 'system') {
        systemIsDark.value = getSystemIsDark()
      }
      bindSystemColorSchemeListener()
    },
    { immediate: true },
  )

  watch(
    theme,
    (mode, previous) => {
      applyThemeToDocument(mode, {
        viewTransition: previous !== undefined,
      })
    },
    { immediate: true },
  )

  watch(focusMode, (value) => {
    localStorage.setItem(focusModeKey, value ? '1' : '0')
  })

  // 维护 / 降级模式状态 — BE GET /api/console/system/maintenance + 503 拦截共同维护
  // enabled=true 时全局 banner 显示;readOnly=true 时所有写按钮禁用;两者均 true 时降级页
  const maintenance = ref<{
    enabled: boolean
    readOnly: boolean
    message: string | null
    etaAt: string | null
  }>({ enabled: false, readOnly: false, message: null, etaAt: null })

  function setMaintenance(state: Partial<typeof maintenance.value>) {
    maintenance.value = { ...maintenance.value, ...state }
  }

  /** 写操作是否被冻结(enabled=true 或 readOnly=true)— 给写按钮 :disabled 用 */
  const writesFrozen = computed(() => maintenance.value.enabled)

  return {
    sidebarCollapsed,
    contentDensity,
    theme,
    themePreference,
    focusMode,
    contentPadding,
    toggleSidebar,
    setSidebarCollapsed,
    setContentDensity,
    setTheme,
    setThemePreference,
    toggleTheme,
    setFocusMode,
    toggleFocusMode,
    maintenance,
    setMaintenance,
    writesFrozen,
  }
})
