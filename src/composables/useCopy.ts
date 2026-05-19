import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { logClick } from '@/utils/logger'

/**
 * 一键复制文本 — 移动端列表里的 ID 字段(traceId / jobCode / instanceNo / workerCode /
 * approvalNo 等)tap 即可拷,toast 提示。
 *
 * 优先用 navigator.clipboard;不支持时回退到 textarea + execCommand。
 */
export function useCopy() {
  const { t } = useI18n({ useScope: 'global' })

  async function copy(text: string | null | undefined, label?: string): Promise<boolean> {
    if (!text) return false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // 兼容老 webview:textarea + select + execCommand
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      ElMessage.success(label ? `${label} ${t('common.copied')}` : t('common.copied'))
      // 复制属于显式用户行为,记埋点;不记 text 原文(可能含敏感 ID,只记 label + len)
      logClick(`mobile:copy:${label || 'text'}`, { len: text.length })
      return true
    } catch {
      ElMessage.error(t('mobile.common.copyFail') || t('common.copyFailed') || 'Copy failed')
      logClick(`mobile:copy:fail:${label || 'text'}`)
      return false
    }
  }

  return { copy }
}
