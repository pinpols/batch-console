import type { Directive } from 'vue'
import { logClick } from '@/utils/logger'

type HoverTabActivateBinding = true | { delay?: number } | undefined

type HoverTabActivateState = {
  handler?: (e: Event) => void
  clearTimer: () => void
  getDelay: () => number
}

const stateMap = new WeakMap<HTMLElement, HoverTabActivateState>()

/**
 * 悬浮即选中：鼠标移入 tab header 时延迟触发点击切换。
 * 默认关闭（避免“悬浮就切换”误触）；需要时显式开启：
 * 用法：
 * <el-tabs v-hover-tab-activate="true" ... />
 * <el-tabs :v-hover-tab-activate="{ delay: 180 }" ... />
 */
export const hoverTabActivateDirective: Directive<HTMLElement, HoverTabActivateBinding> = {
  beforeMount(el) {
    const old = stateMap.get(el)
    if (old) {
      if (old.handler) el.removeEventListener('pointerover', old.handler)
      if (old.clearTimer) {
        el.removeEventListener('pointerleave', old.clearTimer)
        old.clearTimer()
      }
      stateMap.delete(el)
    }
  },
  mounted(el, binding) {
    if (binding.value !== true && typeof binding.value !== 'object') return

    let timer: ReturnType<typeof window.setTimeout> | null = null

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const defaultDelay = 180

    const getDelay = () =>
      binding.value === true
        ? defaultDelay
        : Math.max(0, Number(binding.value?.delay ?? defaultDelay))

    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const header = target.closest('.el-tabs__header') as HTMLElement | null
      if (!header) return
      const item = target.closest('.el-tabs__item') as HTMLElement | null
      if (!item) return
      clearTimer()
      if (item.classList.contains('is-active') || item.classList.contains('is-disabled')) return
      timer = window.setTimeout(() => {
        timer = null
        if (item.classList.contains('is-active') || item.classList.contains('is-disabled')) return
        // 记录悬浮切换
        const label = item.textContent?.trim() || item.id || ''
        logClick(`Tab 悬浮切换:${label}`)
        // 触发 Element Plus tab 切换逻辑
        item.click()
      }, getDelay())
    }

    // 使用事件委托，避免对每个 item 单独绑监听
    el.addEventListener('pointerover', handler, { passive: true })
    el.addEventListener('pointerleave', clearTimer, { passive: true })
    stateMap.set(el, { handler, clearTimer, getDelay })
  },
  unmounted(el) {
    const state = stateMap.get(el)
    if (state?.handler) el.removeEventListener('pointerover', state.handler)
    if (state?.clearTimer) {
      el.removeEventListener('pointerleave', state.clearTimer)
      state.clearTimer()
    }
    stateMap.delete(el)
  },
}
