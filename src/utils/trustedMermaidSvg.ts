import { purifyHtml } from '@/utils/safeHtml'

/**
 * 把 Mermaid 生成的 SVG 安全写入容器。
 *
 * Mermaid 本身使用 `securityLevel: 'strict'`，仍在手工写入 `innerHTML`
 * 前经过 DOMPurify，确保所有这类写入只有一个安全边界。
 */
export function setTrustedMermaidSvg(el: HTMLElement | null | undefined, svg: string): void {
  if (!el) return
  el.innerHTML = purifyHtml(svg)
}

export function clearTrustedSvg(el: HTMLElement | null | undefined): void {
  if (!el) return
  el.textContent = ''
}
