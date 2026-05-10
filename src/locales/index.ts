import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'
import { readLocalePreference, applyLocaleToDocument, type Locale } from '@/constants/locale'

const initial = readLocalePreference()
applyLocaleToDocument(initial)

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initial,
  fallbackLocale: 'zh-CN',
  missingWarn: import.meta.env.DEV,
  fallbackWarn: false,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export type AppI18n = typeof i18n

/** 同步切换:更新 vue-i18n + html lang + localStorage(配套 element-plus / dayjs 等需要在使用方更新) */
export function setI18nLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  applyLocaleToDocument(locale)
}

export { type Locale }
