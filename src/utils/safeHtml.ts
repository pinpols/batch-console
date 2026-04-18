import DOMPurify from 'dompurify'

/**
 * 对一段可能含富文本片段的字符串做 XSS 过滤。
 *
 * 规则：前端独立兜底 —— **所有**需要作为 HTML 渲染的内容必须先过此函数，
 * 不信赖后端是否已转义。`v-safe-html` 指令和 `innerHTML = ...` 场景
 * 都应走这里。
 */
export function purifyHtml(raw: unknown): string {
  if (raw == null) return ''
  const input = typeof raw === 'string' ? raw : String(raw)
  return DOMPurify.sanitize(input, {
    // 默认白名单已够用；显式禁止脚本/嵌入类标签，消除任何歧义
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  })
}
