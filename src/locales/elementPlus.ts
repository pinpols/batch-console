/**
 * Element Plus 内置 locale 适配。
 *
 * 注意:这两个 import 路径必须保留 `.mjs`(默认 `element-plus/es/locale/lang/xxx`
 * 在某些 vite 版本下解析为 .d.ts 而拿到 `undefined`,导致 ConfigProvider 报警),
 * 并且只 import 我们用到的两个 locale,避免把英文/中文整包都打进首屏。
 */
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import type { Locale } from '@/constants/locale'

export type ElementPlusLocale = typeof zhCn

export function resolveElementPlusLocale(locale: Locale): ElementPlusLocale {
  return locale === 'en-US' ? (en as ElementPlusLocale) : zhCn
}
