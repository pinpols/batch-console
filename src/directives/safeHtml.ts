import type { Directive } from 'vue'
import { purifyHtml } from '@/utils/safeHtml'

/**
 * 安全版 `v-html`。使用 DOMPurify 过滤，然后再赋给 `innerHTML`。
 *
 * 项目已通过 ESLint `vue/no-v-html: error` 禁用原生 `v-html`；
 * 任何需要以 HTML 形式渲染的字符串，请统一用 `v-safe-html="content"`。
 *
 *   <div v-safe-html="content" />
 */
export const safeHtmlDirective: Directive<HTMLElement, unknown> = {
  mounted(el, binding) {
    el.innerHTML = purifyHtml(binding.value)
  },
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    el.innerHTML = purifyHtml(binding.value)
  },
  beforeUnmount(el) {
    el.innerHTML = ''
  },
}
