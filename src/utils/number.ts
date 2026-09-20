import { i18n } from '@/locales'

export function fmtNumber(value: unknown, options?: Intl.NumberFormatOptions): string {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return '0'
  return new Intl.NumberFormat(i18n.global.locale.value, options).format(number)
}
