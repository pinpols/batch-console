import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { logClick } from '@/utils/logger'

/**
 * 移动端用户操作埋点 — 全局 click 委托。
 *
 * 在 MobileLayout 挂载一次,捕获所有通过共享 class 渲染的交互元素的 click,
 * 自动 logClick(name, {page, ...meta})。覆盖范围:
 *   .m-btn / .m-tab / .m-page__title-action / .m-page__back / .m-card--clickable
 *   .m-list__row--clickable / .m-copy-text / .mobile-appbar__btn
 *   .m-action-sheet__btn(ActionSheet 的确定/取消)
 *   .mobile-tab(底部 5 个 tab,捕获导航行为)
 *
 * name 解析优先级:`data-track` 属性 → `aria-label` → 文本(80 字符截断)→ class fallback。
 * 业务页面不需要再手写 v-track-click,但仍可以在元素上加 `data-track="..."` 显式命名,
 * 避免文案变更/翻译切换导致事件名飘移。
 */

const SELECTORS = [
  '.m-btn',
  '.m-tab',
  '.m-page__title-action',
  '.m-page__back',
  '.m-card--clickable',
  '.m-list__row--clickable',
  '.m-copy-text',
  '.mobile-appbar__btn',
  '.mobile-tab',
  '.m-action-sheet__btn',
  '.m-account__action',
  '.m-filter-chip__clear',
].join(',')

export function useMobileTracker() {
  const route = useRoute()

  function handler(e: MouseEvent) {
    const root = e.target as HTMLElement | null
    if (!root) return
    const el = root.closest(SELECTORS) as HTMLElement | null
    if (!el) return

    const name = resolveName(el)
    if (!name) return

    // 收集结构化上下文给后端排障/分析用
    const props: Record<string, unknown> = {
      // role 区分 button/tab/option,后端可分桶统计
      role: el.getAttribute('role') ?? undefined,
      // 按钮 disabled 状态:用户尝试点击禁用按钮也是有意义的信号
      disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    }

    // 状态 tab:active 状态在 class 里
    if (el.classList.contains('m-tab') || el.classList.contains('mobile-tab')) {
      props.active =
        el.classList.contains('m-tab--active') || el.classList.contains('mobile-tab--active')
      const tabValue = el.getAttribute('aria-selected')
        ? el.getAttribute('aria-selected')
        : undefined
      if (tabValue !== undefined) props.selected = tabValue
    }

    logClick(name, props)
  }

  onMounted(() => document.addEventListener('click', handler, true))
  onUnmounted(() => document.removeEventListener('click', handler, true))
}

function resolveName(el: HTMLElement): string {
  // 1) data-track:页面显式命名,最稳定
  const explicit = el.getAttribute('data-track')
  if (explicit) return `mobile:${explicit}`

  // 2) aria-label:多语言下也能稳定(后端可按 label 字符串聚合)
  const aria = el.getAttribute('aria-label')
  if (aria) return `mobile:${aria.slice(0, 80)}`

  // 3) 文本(标准化:trim + 多空白合一 + 截断)
  const text = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (text) return `mobile:${text}`

  // 4) class 兜底(几乎只在文本/aria 都没的极端情况)
  const cls = Array.from(el.classList).find((c) => c.startsWith('m-') || c.startsWith('mobile-'))
  return cls ? `mobile:class:${cls}` : 'mobile:click'
}
