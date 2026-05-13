import type { Directive } from 'vue'
import { logClick } from '@/utils/logger'

type HoverRadioActivateBinding = true | { delay?: number } | undefined

type HoverRadioActivateState = {
  handler: (e: Event) => void
  clearTimer: () => void
}

const stateMap = new WeakMap<HTMLElement, HoverRadioActivateState>()

/**
 * 悬浮即选中：用于 Element Plus el-radio-group + el-radio-button 分段控件。
 * 适合低风险筛选项（快捷状态、时间预设），不用于会提交破坏性操作的控件。
 */
export const hoverRadioActivateDirective: Directive<HTMLElement, HoverRadioActivateBinding> = {
  beforeMount(el) {
    const old = stateMap.get(el)
    if (!old) return
    el.removeEventListener('pointerover', old.handler)
    el.removeEventListener('pointerleave', old.clearTimer)
    old.clearTimer()
    stateMap.delete(el)
  },
  mounted(el, binding) {
    if (binding.value !== true && typeof binding.value !== 'object') return

    let timer: ReturnType<typeof window.setTimeout> | null = null
    const defaultDelay = 120
    const getDelay = () =>
      binding.value === true
        ? defaultDelay
        : Math.max(0, Number(binding.value?.delay ?? defaultDelay))

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const item = target.closest('.el-radio-button') as HTMLElement | null
      if (!item || !el.contains(item)) return
      if (item.classList.contains('is-active') || item.classList.contains('is-disabled')) return

      clearTimer()
      timer = window.setTimeout(() => {
        timer = null
        if (item.classList.contains('is-active') || item.classList.contains('is-disabled')) return
        const input = item.querySelector<HTMLInputElement>('input[type="radio"]')
        if (input?.disabled) return
        logClick(`Radio 悬浮切换:${item.textContent?.trim() || input?.value || ''}`)
        item.querySelector<HTMLElement>('.el-radio-button__inner')?.click()
      }, getDelay())
    }

    el.addEventListener('pointerover', handler, { passive: true })
    el.addEventListener('pointerleave', clearTimer, { passive: true })
    stateMap.set(el, { handler, clearTimer })
  },
  unmounted(el) {
    const state = stateMap.get(el)
    if (!state) return
    el.removeEventListener('pointerover', state.handler)
    el.removeEventListener('pointerleave', state.clearTimer)
    state.clearTimer()
    stateMap.delete(el)
  },
}
