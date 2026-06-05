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

  // 兼容老 webview / 非安全上下文:textarea + select + execCommand
  function legacyCopy(text: string): boolean {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }

  async function copy(text: string | null | undefined, label?: string): Promise<boolean> {
    if (!text) return false
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      } else {
        ok = legacyCopy(text)
      }
    } catch {
      // Clipboard API 存在但被拒(非 https/localhost 安全上下文、无权限、无用户手势)→ 回退 execCommand,
      // 不直接报错。此前经隧道/IP 访问时点复制会失败,即此分支。
      ok = legacyCopy(text)
    }
    if (ok) {
      ElMessage.success(label ? `${label} ${t('common.copied')}` : t('common.copied'))
      // 复制属于显式用户行为,记埋点;不记 text 原文(可能含敏感 ID,只记 label + len)
      logClick(`mobile:copy:${label || 'text'}`, { len: text.length })
      return true
    }
    ElMessage.error(t('mobile.common.copyFail') || t('common.copyFailed') || 'Copy failed')
    logClick(`mobile:copy:fail:${label || 'text'}`)
    return false
  }

  return { copy }
}
