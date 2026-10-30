// @ts-check
const { defineConfig, devices } = require('@playwright/test')
const { FRONTEND_BASE_URL } = require('./e2e/config.cjs')

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: 'visual-regression.spec.ts',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 },
  },
  reporter: [['list'], ['json', { outputFile: 'playwright-report/visual-results.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: FRONTEND_BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    colorScheme: 'dark',
  },
  webServer:
    process.env.E2E_TARGET_ENV === 'staging' ||
    process.env.E2E_BASE_URL ||
    process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: 'npm run dev -- --host 127.0.0.1',
          url: 'http://localhost:5173/login',
          reuseExistingServer: true,
          timeout: 120_000,
        },
})
