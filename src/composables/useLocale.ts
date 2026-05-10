import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  writeLocalePreference,
  type Locale,
} from '@/constants/locale'
import { setI18nLocale } from '@/locales'

/**
 * 语言切换 composable。
 * - `current`:当前 locale(响应式)
 * - `options`:供 select/dropdown 用的选项数组
 * - `setLocale(next)`:同步 vue-i18n + html lang + localStorage
 */
export function useLocale() {
  const { locale } = useI18n()

  const current = computed<Locale>(() => locale.value as Locale)

  const options = SUPPORTED_LOCALES.map((value) => ({
    value,
    label: LOCALE_LABELS[value],
  }))

  function setLocale(next: Locale): void {
    if (next === current.value) return
    setI18nLocale(next)
    writeLocalePreference(next)
  }

  return { current, options, setLocale }
}
