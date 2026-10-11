import { ElMessage } from 'element-plus'
import { h } from 'vue'
import { i18n } from '@/locales'

type ErrorToastOptions = {
  /** 加粗显示的简短标题 */
  title: string
  /** 主要消息内容 */
  message: string
  /** 用于后端关联查询的可选 traceId/requestId */
  traceId?: string
  /** 显示在消息下方的可选后续操作建议 */
  suggestion?: string
  /** 提示显示时长（毫秒），默认值根据是否存在 traceId 决定 */
  duration?: number
}

async function copyText(text: string) {
  if (!text) return false
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(i18n.global.t('errorToast.copySuccess'))
      return true
    } catch {
      // Clipboard API 不可用时继续尝试兼容方案。
    }
  }

  let el: HTMLTextAreaElement | undefined
  try {
    el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', 'true')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    if (document.execCommand('copy')) {
      ElMessage.success(i18n.global.t('errorToast.copySuccess'))
      return true
    }
  } catch {
    // 统一在下方给出复制失败反馈。
  } finally {
    el?.remove()
  }
  ElMessage.error(i18n.global.t('errorToast.copyFailed'))
  return false
}

export function showErrorToast(opts: ErrorToastOptions) {
  const trace = opts.traceId?.trim()
  const duration = opts.duration ?? (trace ? 6500 : 4000)

  ElMessage.error({
    duration,
    showClose: true,
    message: h(
      'div',
      { class: 'error-toast' },
      [
        h('div', { class: 'error-toast__title' }, opts.title),
        h('div', { class: 'error-toast__message' }, opts.message),
        opts.suggestion ? h('div', { class: 'error-toast__suggestion' }, opts.suggestion) : null,
        trace
          ? h('div', { class: 'error-toast__trace' }, [
              h('span', { class: 'error-toast__trace-label' }, 'TraceId'),
              h(
                'code',
                {
                  class: 'error-toast__trace-code',
                  title: i18n.global.t('errorToast.copyTraceTitle'),
                  onClick: () => copyText(trace),
                },
                trace,
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'error-toast__trace-copy',
                  onClick: () => copyText(trace),
                },
                i18n.global.t('common.copy'),
              ),
            ])
          : null,
      ].filter(Boolean),
    ),
  })
}
