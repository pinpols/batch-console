import { test, expect } from '@playwright/test'
const config = require('./config.cjs')

test('basic test', async ({ page }) => {
  await page.goto(config.FRONTEND_BASE_URL)
  expect(page).toBeDefined()
})
