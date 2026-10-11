import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { STORAGE_KEYS } from '../../src/constants/storageKeys'
import { FRONTEND_ORIGIN } from './config'
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

export async function seedStorageForConfiguredOrigin(page: Page): Promise<void> {
  const statePath = path.resolve(__dirname, '../.auth/user.json')
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as {
    origins: Array<{
      origin: string
      localStorage: Array<{ name: string; value: string }>
    }>
  }
  const storedOrigin = state.origins.find((origin) => origin.localStorage.length > 0)
  if (!storedOrigin || storedOrigin.origin === FRONTEND_ORIGIN) return

  await page.addInitScript((entries) => {
    for (const entry of entries) {
      if (localStorage.getItem(entry.name) === null) {
        localStorage.setItem(entry.name, entry.value)
      }
    }
  }, storedOrigin.localStorage)
}
