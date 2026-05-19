/**
 * 桌面/平板/手机 响应式断点 token — 统一源。
 *
 * 之前各组件用了 9 个散值(480/520/640/720/768/820/900/960/1100),互不一致,
 * 改一个 breakpoint 要扫 17 个 @media。这里收敛为 6 档,语义化命名,CSS / TS 共用。
 *
 * 取值参考 Tailwind / Element Plus 默认断点,在主流笔电(1366/1440)和大屏(1920+)
 * 都有自然的视觉分隔。
 *
 * 用法:
 *   - CSS: `@media (max-width: 768px) { ... }` — 直接写数字
 *     或 (推荐) 用 :root 暴露的 CSS var 调用 `min(100%, var(--bp-lg))`
 *   - TS: `import { BP } from '@/constants/breakpoints'`,`window.matchMedia(BP.mdMq)`
 */

export const BP = {
  /** 小手机:≤480 (单列卡片) */
  xs: 480,
  /** 大手机 / 小平板:≤768 */
  sm: 768,
  /** 平板 / 笔电:≤1024 */
  md: 1024,
  /** 标准笔电:≤1280 (1366×768 也命中 md) */
  lg: 1280,
  /** 标准桌面:≤1536 */
  xl: 1536,
  /** 大屏 / 2K:≤1920 */
  xxl: 1920,
} as const

export type BPName = keyof typeof BP

/** matchMedia 表达式 — useResponsive composable 用 */
export const BP_MQ = {
  xs: `(max-width: ${BP.xs}px)`,
  sm: `(max-width: ${BP.sm}px)`,
  md: `(max-width: ${BP.md}px)`,
  lg: `(max-width: ${BP.lg}px)`,
  xl: `(max-width: ${BP.xl}px)`,
  xxl: `(max-width: ${BP.xxl}px)`,
  /** 大屏正向匹配(>1920),内容容器上限触发条件 */
  ultrawide: `(min-width: ${BP.xxl + 1}px)`,
} as const

/** 桌面内容最大宽度 — 大屏避免内容拉成 4000px 阅读距离过宽 */
export const CONTENT_MAX_WIDTH = 1600
