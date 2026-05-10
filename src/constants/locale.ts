export const LOCALE_STORAGE_KEY = 'batch-console:locale'

export type Locale = 'zh-CN' | 'en-US'

export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US']

export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh-CN'
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const raw of langs) {
    if (!raw) continue
    const lower = raw.toLowerCase()
    if (lower.startsWith('zh')) return 'zh-CN'
    if (lower.startsWith('en')) return 'en-US'
  }
  return 'zh-CN'
}

export function readLocalePreference(): Locale {
  // 测试环境下 localStorage 可能是部分桩(jsdom 没初始化或被替换),
  // typeof 检查不能保证有方法,所以再 try/catch 兜一层。
  try {
    const v = globalThis.localStorage?.getItem?.(LOCALE_STORAGE_KEY)
    if (v === 'zh-CN' || v === 'en-US') return v
  } catch {
    /* ignore */
  }
  return detectBrowserLocale()
}

export function writeLocalePreference(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem?.(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export function applyLocaleToDocument(locale: Locale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}
