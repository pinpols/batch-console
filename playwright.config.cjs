// @ts-check
const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  // 每次运行前刷新 token + 上传 seed 到 ta/tb/tc（非 CI 也执行，避免 storageState 过期）
  globalSetup: require.resolve('./e2e/global-setup.cjs'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  bail: 0,
  // 单个测试 25s（从 15s 调大），容忍冷启动 + 网络抖动
  timeout: 25_000,
  expect: { timeout: 8_000 },
  // 全局 30 分钟兜底（原来 3 分钟太紧）
  globalTimeout: 1_800_000,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'e2e/.auth/user.json',
    navigationTimeout: 10_000,
    actionTimeout: 5_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
