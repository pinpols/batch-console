import { test, expect } from '@playwright/test'
import { isVisible } from './app'

test.use({ storageState: { cookies: [], origins: [] } })

test('可见性助手等待延迟渲染的元素', async ({ page }) => {
  await page.setContent('<main></main>')
  await page.evaluate(() => {
    window.setTimeout(() => {
      const button = document.createElement('button')
      button.textContent = '延迟操作'
      document.querySelector('main')!.append(button)
    }, 100)
  })
  const visible = await isVisible(page.getByRole('button', { name: '延迟操作' }), 2_000)
  expect(visible).toBe(true)
})

test('可见性助手在期限内未出现元素时返回 false', async ({ page }) => {
  await page.setContent('<main></main>')
  const visible = await isVisible(page.getByRole('button', { name: '不存在的操作' }), 100)
  expect(visible).toBe(false)
})
