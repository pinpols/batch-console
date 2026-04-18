import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [{ name: 'chromium' }],
})
