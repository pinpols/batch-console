import type { Directive } from 'vue'
import { logClick } from '@/utils/logger'
import { trackClick as trackClickTelemetry } from '@/utils/telemetry'

/**
 * v-track-click 指令 — 元素被点击时自动写入一条操作日志。
 *
 * 用法：
 *   <el-button v-track-click="'触发 Job'">触发</el-button>
 *   <el-button v-track-click="{ action: '审批通过', id: row.id }">通过</el-button>
 *
 * 值为字符串时直接作为 message；值为对象时取 action 字段作 message，其余作 detail。
 */
type TrackClickValue = string | { action: string; [key: string]: unknown }

function handleClick(value: TrackClickValue) {
  if (typeof value === 'string') {
    logClick(value)
    trackClickTelemetry(value)
  } else {
    const { action, ...rest } = value
    const detail = Object.keys(rest).length ? rest : undefined
    logClick(action, detail)
    trackClickTelemetry(action, detail)
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
