import { STORAGE_KEYS } from './storage'
import type { Page } from '@playwright/test'

export type E2eLocale = 'zh-CN' | 'en-US'

export type LocalizedExpectation =
  string | RegExp | { 'zh-CN': string | RegExp; 'en-US': string | RegExp }

export function localized(zhCN: string | RegExp, enUS: string | RegExp): LocalizedExpectation {
  return { 'zh-CN': zhCN, 'en-US': enUS }
}

export async function setE2eLocale(page: Page, locale: E2eLocale): Promise<void> {
  await page.evaluate((nextLocale) => {
    localStorage.setItem(STORAGE_KEYS.locale, nextLocale)
  }, locale)
}

export async function currentE2eLocale(page: Page): Promise<E2eLocale> {
  const locale = await page.evaluate(() => localStorage.getItem(STORAGE_KEYS.locale))
  return locale === 'en-US' ? 'en-US' : 'zh-CN'
}

export async function resolveLocalizedExpectation(
  page: Page,
  expected: LocalizedExpectation,
): Promise<string | RegExp> {
  if (typeof expected === 'string' || expected instanceof RegExp) return expected
  const locale = await currentE2eLocale(page)
  return expected[locale]
}
