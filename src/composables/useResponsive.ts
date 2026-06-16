import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  BP,
  BP_MQ,
  SIDEBAR_AUTOCOLLAPSE_MQ,
  SIDEBAR_AUTOCOLLAPSE_W,
  type BPName,
} from '@/constants/breakpoints'

/**
 * 响应式视口探测 — 用 matchMedia 监听 `BP_MQ` 各档,避免散落的
 * `window.innerWidth` 用法(无法在 SSR 或 jsdom 等无 layout 环境运行,且 resize
 * listener 各组件各装一遍易漏 cleanup)。
 *
 * - `isMobile`: ≤ sm (768)
 * - `isTablet`: > sm 且 ≤ lg (1280) — 笔电 / 大平板
 * - `isDesktop`: > lg
 * - `isCompact`: ≤ 1440(含 mobile/tablet)— 宽度紧时收起侧栏腾内容的 UX 阈值
 * - `breakpoint`: 当前匹配的最小命中档(xs/sm/md/lg/xl/xxl/ultrawide)
 *
 * 所有 listener 在 onMounted 注册 / onBeforeUnmount 自动清理。
 */
export function useResponsive() {
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isDesktop = ref(true)
  // 紧凑桌面(≤1440,含笔电与手机)— 供侧栏等"宽度紧时收起腾内容"的 UX 用,独立于 isTablet 语义
  const isCompact = ref(false)
  const breakpoint = ref<BPName | 'ultrawide'>('lg')

  // mq 句柄 + 对应 listener,统一 cleanup
  const handles: Array<{ mq: MediaQueryList; fn: (e: MediaQueryListEvent) => void }> = []

  function compute() {
    if (typeof window === 'undefined') return
    const w = window.innerWidth
    isMobile.value = w <= BP.sm
    isTablet.value = w > BP.sm && w <= BP.lg
    isDesktop.value = w > BP.lg
    isCompact.value = w <= SIDEBAR_AUTOCOLLAPSE_W
    if (w <= BP.xs) breakpoint.value = 'xs'
    else if (w <= BP.sm) breakpoint.value = 'sm'
    else if (w <= BP.md) breakpoint.value = 'md'
    else if (w <= BP.lg) breakpoint.value = 'lg'
    else if (w <= BP.xl) breakpoint.value = 'xl'
    else if (w <= BP.xxl) breakpoint.value = 'xxl'
    else breakpoint.value = 'ultrawide'
  }

  function register(query: string) {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const fn = () => compute()
    // Safari < 14 只支持 addListener,但本仓主流目标浏览器都支持 addEventListener
    mq.addEventListener('change', fn)
    handles.push({ mq, fn })
  }

  onMounted(() => {
    compute()
    // 监听各档:任一档变化都重算 — 避免漏判跨档场景
    register(BP_MQ.xs)
    register(BP_MQ.sm)
    register(BP_MQ.md)
    register(BP_MQ.lg)
    register(BP_MQ.xl)
    register(BP_MQ.xxl)
    register(SIDEBAR_AUTOCOLLAPSE_MQ)
  })

  onBeforeUnmount(() => {
    for (const { mq, fn } of handles) mq.removeEventListener('change', fn)
    handles.length = 0
  })

  return {
    isMobile,
    isTablet,
    isDesktop,
    isCompact,
    breakpoint: computed(() => breakpoint.value),
  }
}
