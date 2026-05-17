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
    // 4-worker 并发对 dev server + backend 的压力较大，偶发 page.goto 10s
    // 和 click 5s 超时都不是代码 bug；给出更稳的预算
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // D 档:多浏览器矩阵。默认只跑 chromium(本地 dev 友好);
  // 设 CROSS_BROWSER=1 启用 firefox + webkit + mobile-chrome。
  // release pre-flight 用 `CROSS_BROWSER=1 npx playwright test --grep "@cross-browser"`。
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.CROSS_BROWSER === '1'
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
