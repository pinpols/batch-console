import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'

const baseURL = 'http://localhost:5173'
const authState = JSON.parse(readFileSync('./e2e/.auth/user.json', 'utf-8'))

const results = []
let pass = 0, fail = 0

async function runTest(name, fn) {
  const browser = await chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({ storageState: authState, baseURL })
    const page = await ctx.newPage()
    page.setDefaultTimeout(10000)
    await fn(page)
    results.push({ name, status: 'pass' })
    console.log(`✓ ${name}`)
    pass++
  } catch(e) {
    results.push({ name, status: 'fail', error: e.message.split('\n')[0] })
    console.log(`✗ ${name}`)
    console.log(`  ${e.message.split('\n')[0]}`)
    fail++
  } finally {
    await browser.close()
  }
}

async function checkPage(page, path, expectedTitle) {
  await page.goto(path)
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 8000 })
  if (expectedTitle) {
    await page.waitForSelector(`text=${expectedTitle}`, { timeout: 8000 })
  }
}

// Auth check
await runTest('auth: loads ops/summary without login redirect', async (page) => {
  await page.goto('/')
  await page.waitForURL(/ops\/summary/, { timeout: 10000 })
})

// Navigation smoke tests
const pages = [
  ['/ops/summary', '运营概览'],
  ['/approvals', '审批中心'],
  ['/reports', '报表导出'],
  ['/files/list', '文件列表'],
  ['/files/templates', '文件模板'],
  ['/jobs/definitions', 'Job 定义'],
  ['/workflow/definitions', 'Workflow 定义'],
  ['/monitor/job-instances', 'Job Instance'],
  ['/monitor/workflow-runs', 'Workflow Run'],
  ['/logs', '执行日志'],
  ['/observability/alerts', '告警'],
  ['/observability/audits', '审计日志'],
  ['/scheduler/snapshot', '调度快照'],
  ['/scheduler/batch-days', '批次日历日'],
  ['/workers/management', 'Worker'],
  ['/config/excel', 'Excel'],
  ['/config/management', '配置管理'],
  ['/system/tenants', '租户管理'],
  ['/system/user-accounts', '用户账户'],
  ['/system/api-keys', 'API Key'],
  ['/system/parameters', '系统参数'],
  ['/system/notifications', '通知'],
  ['/system/triggers', 'Trigger'],
  ['/system/tags', '标签管理'],
  ['/system/event-catalog', '事件目录'],
  ['/governance/quota', '配额'],
  ['/observability/queries', '可观测性'],
  ['/self-service', '自助服务'],
]

for (const [path, titleHint] of pages) {
  await runTest(`page: ${path} shows "${titleHint}"`, async (page) => {
    await checkPage(page, path, titleHint)
  })
}

console.log(`\n${pass} passed, ${fail} failed out of ${pass+fail} tests`)
writeFileSync('/tmp/pw-node-results.json', JSON.stringify({ pass, fail, results }, null, 2))
