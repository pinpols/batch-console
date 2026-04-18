import * as fs from 'fs'
import * as path from 'path'
import { test as base, expect } from '@playwright/test'

type ConsoleEntry = { time: string; type: string; text: string }

/**
 * 扩展 Playwright test，自动在每个用例中：
 *   1. 收集所有 console 输出（log / warn / error / pageerror）
 *   2. 测试失败时将日志写入 test-results/<test-id>/console.log
 *      （与 trace / screenshot / video 存放在同一目录，方便排查）
 */
const test = base.extend<{ _consoleLogs: ConsoleEntry[] }>({
  _consoleLogs: [
    async ({ page }, use, testInfo) => {
      const logs: ConsoleEntry[] = []

      page.on('console', (msg) => {
        logs.push({ time: new Date().toISOString(), type: msg.type(), text: msg.text() })
      })

      page.on('pageerror', (err) => {
        logs.push({ time: new Date().toISOString(), type: 'pageerror', text: err.message })
      })

      await use(logs)

      // 仅失败时落盘（与 trace / screenshot 策略一致）
      if (testInfo.status !== testInfo.expectedStatus && logs.length > 0) {
        const logFile = path.join(testInfo.outputDir, 'console.log')
        fs.mkdirSync(testInfo.outputDir, { recursive: true })
        const content = logs
          .map((l) => `[${l.time}] [${l.type.toUpperCase().padEnd(9)}] ${l.text}`)
          .join('\n')
        fs.writeFileSync(logFile, content, 'utf8')
        await testInfo.attach('console.log', { path: logFile, contentType: 'text/plain' })
      }
    },
    { auto: true }, // 所有用例自动启用，无需手动注入
  ],
})

export { test, expect }
