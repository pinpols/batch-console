import { purifyHtml } from '@/utils/safeHtml'

/**
 * Render Mermaid's generated SVG into a container.
 *
 * Mermaid is initialized with `securityLevel: 'strict'` at call sites, and we still
 * pass the generated SVG through DOMPurify before assigning `innerHTML` so manual
 * HTML writes have one centralized safety boundary.
 */
export function setTrustedMermaidSvg(el: HTMLElement | null | undefined, svg: string): void {
  if (!el) return
  el.innerHTML = purifyHtml(svg)
}

export function clearTrustedSvg(el: HTMLElement | null | undefined): void {
  if (!el) return
  el.textContent = ''
}
