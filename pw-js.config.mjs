import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'test.mjs',
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [{ name: 'chromium' }],
})
