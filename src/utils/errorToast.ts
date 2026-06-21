import { ElMessage } from 'element-plus'
import { h } from 'vue'
import { i18n } from '@/locales'

type ErrorToastOptions = {
  /** Short title shown in bold */
  title: string
  /** Main message content */
  message: string
  /** Optional traceId/requestId for backend correlation */
  traceId?: string
  /** Optional "what to do next" suggestion line, shown below the message. */
  suggestion?: string
  /** How long to show the toast (ms). Defaults based on traceId presence. */
  duration?: number
}

function copyText(text: string) {
  if (!text) return
  // Prefer Clipboard API; fallback to legacy execCommand.
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      /* ignore */
    })
    return
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', 'true')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  } catch {
    /* ignore */
  }
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
