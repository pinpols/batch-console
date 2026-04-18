import type { Directive } from 'vue'
import { logClick } from '@/utils/logger'

/**
 * v-track-click 指令 — 元素被点击时自动写入一条操作日志。
 *
 * 用法:
 *   <el-button v-track-click="'触发 Job'">触发</el-button>
 *   <el-button v-track-click="{ action: '审批通过', id: row.id }">通过</el-button>
 *
 * 值为字符串时直接作为 name;值为对象时取 `action` 字段作 name,其余字段作 props。
 */
type TrackClickValue = string | { action: string; [key: string]: unknown }

function handleClick(value: TrackClickValue) {
  if (typeof value === 'string') {
    logClick(value)
  } else {
    const { action, ...rest } = value
    logClick(action, Object.keys(rest).length ? rest : undefined)
  }
}

export const trackClickDirective: Directive<HTMLElement, TrackClickValue> = {
  mounted(el, binding) {
    const handler = () => handleClick(binding.value)
    ;(el as HTMLElement & { __trackClick?: () => void }).__trackClick = handler
    el.addEventListener('click', handler, true)
  },

  updated(el, binding) {
    const ext = el as HTMLElement & { __trackClick?: () => void }
    if (ext.__trackClick) {
      el.removeEventListener('click', ext.__trackClick, true)
    }
    const handler = () => handleClick(binding.value)
    ext.__trackClick = handler
    el.addEventListener('click', handler, true)
  },

  beforeUnmount(el) {
    const ext = el as HTMLElement & { __trackClick?: () => void }
    if (ext.__trackClick) {
      el.removeEventListener('click', ext.__trackClick, true)
      delete ext.__trackClick
    }
  },
}
