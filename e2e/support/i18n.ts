import { STORAGE_KEYS } from './storage'
import { DEFAULT_LOCALE } from './config'
import type { Page } from '@playwright/test'
import enUS from '../../src/locales/en-US'
import zhCN from '../../src/locales/zh-CN'

export type E2eLocale = 'zh-CN' | 'en-US'

export const E2E_DEFAULT_LOCALE = DEFAULT_LOCALE as E2eLocale

export type LocalizedExpectation =
  | string
  | RegExp
  | { 'zh-CN': string | RegExp; 'en-US': string | RegExp }
  | { key: string }

const messages: Record<E2eLocale, unknown> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export function localized(zhCN: string | RegExp, enUS: string | RegExp): LocalizedExpectation {
  return { 'zh-CN': zhCN, 'en-US': enUS }
}

export function i18nKey(key: string): LocalizedExpectation {
  return { key }
}

export function e2eText(key: string, locale: E2eLocale = E2E_DEFAULT_LOCALE): string {
  let value: unknown = messages[locale]
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) {
      throw new Error(`[e2e-i18n] missing ${locale} key: ${key}`)
    }
    value = (value as Record<string, unknown>)[segment]
  }
  if (typeof value !== 'string') {
    throw new Error(`[e2e-i18n] key is not a message string: ${locale}:${key}`)
  }
  return value
}

export async function installE2eLocale(
  page: Page,
  locale: E2eLocale = E2E_DEFAULT_LOCALE,
): Promise<void> {
  await page.addInitScript(
    ({ localeKey, nextLocale }) => localStorage.setItem(localeKey, nextLocale),
    { localeKey: STORAGE_KEYS.locale, nextLocale: locale },
  )
}

export async function setE2eLocale(page: Page, locale: E2eLocale): Promise<void> {
  await page.evaluate(
    ({ localeKey, nextLocale }) => localStorage.setItem(localeKey, nextLocale),
    { localeKey: STORAGE_KEYS.locale, nextLocale: locale },
  )
}

export async function currentE2eLocale(page: Page): Promise<E2eLocale> {
  const locale = await page.evaluate((localeKey) => localStorage.getItem(localeKey), STORAGE_KEYS.locale)
  return locale === 'en-US' ? 'en-US' : 'zh-CN'
}

export async function resolveLocalizedExpectation(
  page: Page,
  expected: LocalizedExpectation,
): Promise<string | RegExp> {
  if (typeof expected === 'string' || expected instanceof RegExp) return expected
  const locale = await currentE2eLocale(page)
  if ('key' in expected) return e2eText(expected.key, locale)
  return expected[locale]
}
