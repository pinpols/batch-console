import type { Page } from '@playwright/test'
import { STORAGE_KEYS } from '../../src/constants/storageKeys'
export { STORAGE_KEYS }

type StorageValues = Partial<Record<keyof typeof STORAGE_KEYS, string>>

export async function seedBrowserStorage(page: Page, values: StorageValues): Promise<void> {
  const entries = Object.entries(values).map(([key, value]) => [
    STORAGE_KEYS[key as keyof typeof STORAGE_KEYS],
    value,
  ])
  await page.addInitScript((items) => {
    for (const [key, value] of items) localStorage.setItem(key, value)
  }, entries)
  if (page.url() !== 'about:blank') {
    await page.evaluate((items) => {
      for (const [key, value] of items) localStorage.setItem(key, value)
    }, entries)
  }
}

export async function readBrowserStorage(
  page: Page,
  key: keyof typeof STORAGE_KEYS,
): Promise<string | null> {
  const storageKey = STORAGE_KEYS[key]
  return page.evaluate((name) => localStorage.getItem(name), storageKey)
}
