#!/usr/bin/env node
/**
 * fe-real-usage-audit.cjs — 真实使用视角的前端审计(本地脚本)
 *
 * 为什么需要它:既有 *-crud / e2e 多断言「操作成功/不崩」,会漏「值渲染对不对 / 点了报不报错 /
 * 真实业务流程能不能走通」。本脚本换断言层次,像真实用户/运维那样把页面用一遍,主动暴露
 * 「能打开但不能用」的问题(字段映射漂移、表单默认值违反 BE 约束、写操作 400、导航 not-found 等)。
 *
 * 三个模式(默认全跑):
 *   --audit      每页:无错误 toast(资源不存在/请求失败/unsupported/not found)+ 表格渲染真实值 + 无 JS 错
 *   --interact   每页:点工具栏「新增」+ 首行操作 + 打开的表单填值真提交,抓真 bug(排除表单校验类)
 *   --scenario   操作员旅程:配置包往返导入 → 触发作业 → 监控 rerun,逐步强断言(配置实体的
 *                增删改由 --interact 逐页覆盖)
 *
 * 用法(需 dev server 在 5173、后端 18080;脚本自行 UI 登录 admin):
 *   node scripts/local/fe-real-usage-audit.cjs              # 全跑
 *   node scripts/local/fe-real-usage-audit.cjs --scenario   # 只跑操作员旅程
 *   BASE=http://localhost:4173 TENANT=ta node scripts/local/fe-real-usage-audit.cjs
 *
 * 退出码:发现真 bug → 1;全干净 → 0(供 CI / pre-release gate 用)。
 */
const { chromium } = require('playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const BASE = process.env.BASE || 'http://localhost:5173'
const TENANT = process.env.TENANT || 'ta'
const USER = process.env.FE_AUDIT_USER || 'admin'
const PASS = process.env.FE_AUDIT_PASS || 'admin123'
const TENANT_KEY = 'batch-console-tenant-id'
const TS = Date.now().toString().slice(-7)

const args = process.argv.slice(2)
const runAll = !args.some((a) => ['--audit', '--interact', '--scenario'].includes(a))
const want = (m) => runAll || args.includes(m)

// 租户依赖、最易暴露问题的页面
const ROUTES = [
  '/jobs/pipelines', '/jobs/definitions', '/files/templates', '/files/channels', '/files/list',
  '/files/arrival-groups', '/governance/quota', '/governance/queues', '/observability/alerts',
  '/observability/alert-routings', '/observability/outbox', '/scheduler/batch-days',
  '/ops/custom-task-types', '/ops/worker-fingerprints', '/system/tags', '/system/notifications',
  '/system/triggers', '/system/api-keys', '/config/releases', '/config/management', '/approvals',
  '/workflow/definitions', '/monitor/job-instances', '/monitor/workflow-runs', '/runs',
  '/workers/management',
]
// 错误 toast 文案 = 客户可见报错;但排除业务正常提示
const ERROR_TEXT = /资源不存在|请求失败|unsupported|not found|加载失败|系统错误|渲染异常|违反约束|NullPointer/i
const VALIDATION = /不能为空|请填写|请选择|请输入|必填|长度|超长|格式不|invalid format|required/i
const BUSINESS_OK = /未找到可重放候选|已有|冲突|不存在|无候选|empty|no data/i

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ acceptDownloads: true })
  const page = await ctx.newPage()
  let js = []
  page.on('pageerror', (e) => js.push('JS:' + e.message.split('\n')[0].slice(0, 70)))
  const nClick = async (loc) => { const h = await loc.elementHandle().catch(() => null); if (!h) return false; await page.evaluate((el) => el.click(), h).catch(() => {}); return true }
  const errToasts = async () => (await page.locator('.el-message--error,.el-notification--error').allTextContents().catch(() => [])).map((s) => s.replace(/\s+/g, ' ').trim())
  const clear = async () => { await page.evaluate(() => document.querySelectorAll('.el-message,.el-notification').forEach((e) => e.remove())).catch(() => {}) }

  // ── 登录 + 设当前租户 ──
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.locator('input[type=text]').first().fill(USER)
  await page.locator('input[type=password]').first().fill(PASS)
  await page.locator('button:has-text("Sign in"),button:has-text("登录")').first().click()
  await sleep(3000)
  if (page.url().includes('/login')) { console.error('✗ 登录失败,检查 dev server / 凭据'); await browser.close(); process.exit(2) }
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [TENANT_KEY, TENANT])
  console.log(`登录 ${USER} / 租户 ${TENANT} ✓\n`)

  const realBugs = []

  // ───────── 模式 1:页面审计 ─────────
  if (want('--audit')) {
    console.log('═══ 1. 页面审计(无错误 toast + 数据渲染 + 无 JS 错)═══')
    for (const route of ROUTES) {
      js = []; await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {})
      await sleep(2200)
      if (!page.url().includes(route)) { console.log(`  r  ${route} → 重定向(权限)`); continue }
      const toasts = (await errToasts()).filter((s) => ERROR_TEXT.test(s))
      const issues = []
      if (toasts.length) issues.push('错误toast:' + toasts.map((s) => s.slice(0, 36)).join(';'))
      if (js.length) issues.push(js.slice(0, 2).join(';'))
      const rows = page.locator('.el-table__row')
      if ((await rows.count().catch(() => 0)) > 0) {
        const cells = (await rows.first().locator('td .cell').allTextContents().catch(() => [])).map((c) => c.trim())
        const first = cells.slice(0, Math.min(5, cells.length))
        if (first.length >= 3 && first.every((c) => !c || c === '—' || c === '-')) issues.push('表格首行前' + first.length + '列全空/—(字段映射漂移)')
      }
      if (issues.length) { realBugs.push({ where: '审计 ' + route, why: issues.join(' | ') }); console.log(`  ✗  ${route}\n       ${issues.join('\n       ')}`) }
      else console.log(`  ✓  ${route}`)
      await clear()
    }
  }

  // ───────── 模式 2:穷尽交互 ─────────
  if (want('--interact')) {
    console.log('\n═══ 2. 穷尽交互(点新增/行操作 + 真提交,排除校验类)═══')
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {}); await sleep(2000)
      if (!page.url().includes(route)) continue
      const targets = []
      const addBtn = page.locator('button').filter({ hasText: /新增|新建|创建|添加|Create|New|Add/ }).first()
      if (await addBtn.count().catch(() => 0)) targets.push('新增')
      const row = page.locator('.el-table__row').first()
      if (await row.count().catch(() => 0)) {
        const btns = row.locator('button'); const n = Math.min(await btns.count().catch(() => 0), 6)
        for (let i = 0; i < n; i++) { const tx = ((await btns.nth(i).textContent().catch(() => '')) || '').trim(); if (tx && !/刷新|Refresh|搜索|Search|重置|Reset/.test(tx) && !targets.includes(tx)) targets.push(tx) }
      }
      for (const label of targets) {
        js = []; await clear()
        const loc = label === '新增'
          ? page.locator('button').filter({ hasText: /新增|新建|创建|添加|Create|New|Add/ }).first()
          : page.locator('.el-table__row').first().locator('button').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
        if (!(await loc.count().catch(() => 0))) continue
        await nClick(loc); await sleep(1100)
        let errs = await errToasts()
        const dlg = page.locator('.el-dialog:visible,.el-drawer:visible').first()
        if (await dlg.count().catch(() => 0)) {
          const txts = dlg.locator('input[type=text]:visible,textarea:visible'); const tn = Math.min(await txts.count().catch(() => 0), 6)
          for (let i = 0; i < tn; i++) await txts.nth(i).fill('audit' + TS + i, { timeout: 1000 }).catch(() => {})
          const sels = dlg.locator('.el-select:visible'); const sn = Math.min(await sels.count().catch(() => 0), 5)
          for (let i = 0; i < sn; i++) { await nClick(sels.nth(i)); await sleep(300); const o = page.locator('.el-select-dropdown__item:visible').first(); if (await o.count()) await nClick(o); await sleep(120) }
          await nClick(dlg.locator('button').filter({ hasText: /确定|保存|提交|创建|Save|Submit|Confirm/ }).first()); await sleep(1600)
          errs = errs.concat(await errToasts())
        }
        const conf = page.locator('.el-message-box__btns button').filter({ hasText: /确定|通过|确认|Confirm|OK/ }).first()
        if (await conf.count().catch(() => 0)) { await nClick(conf); await sleep(1300); errs = errs.concat(await errToasts()) }
        const all = [...new Set([...errs, ...js])].filter((e) => e && !/已复制/.test(e))
        const bugs = all.filter((e) => (ERROR_TEXT.test(e) || e.startsWith('JS:')) && !VALIDATION.test(e) && !BUSINESS_OK.test(e))
        if (bugs.length) { realBugs.push({ where: `交互 ${route} [${label}]`, why: bugs.map((s) => s.slice(0, 46)).join(' ; ') }); console.log(`  ✗  ${route} 点[${label}]: ${bugs.map((s) => s.slice(0, 46)).join(' ; ')}`) }
        await page.keyboard.press('Escape').catch(() => {}); await sleep(250)
        await page.evaluate(() => document.querySelectorAll('.el-overlay,.el-overlay-dialog').forEach((e) => e.remove())).catch(() => {})
      }
    }
    console.log('  (未列出 = 无真 bug)')
  }

  // ───────── 模式 3:操作员旅程 ─────────
  if (want('--scenario')) {
    console.log('\n═══ 3. 操作员旅程(配置包往返导入 → 触发作业 → 监控 rerun)═══')
    const steps = []
    const step = async (name, fn) => { js = []; await clear(); try { const d = await fn(); const errs = [...new Set([...(await errToasts()), ...js])].filter((e) => e && !/已复制/.test(e) && !BUSINESS_OK.test(e)); if (errs.length) { steps.push({ name, ok: false, why: errs.map((s) => s.slice(0, 44)).join(';') }); realBugs.push({ where: '旅程 ' + name, why: errs.map((s) => s.slice(0, 44)).join(';') }) } else steps.push({ name, ok: true, d: d || '' }) } catch (e) { steps.push({ name, ok: false, why: e.message.slice(0, 60) }); realBugs.push({ where: '旅程 ' + name, why: e.message.slice(0, 60) }) } await page.keyboard.press('Escape').catch(() => {}); await sleep(300) }
    const searchHasRow = async (kw) => { const s = page.locator('input[placeholder*="Code"],input[placeholder*="code"],input[placeholder*="编码"],input[placeholder*="搜索"],input[placeholder*="jobCode"]').first(); if (await s.count().catch(() => 0)) { await s.fill(kw).catch(() => {}); await s.press('Enter').catch(() => {}); await sleep(1600) } const rows = page.locator('.el-table__row'); const n = await rows.count().catch(() => 0); for (let i = 0; i < n; i++) if (((await rows.nth(i).textContent().catch(() => '')) || '').includes(kw)) return true; return false }

    await step('配置包 导出→重传→预览', async () => {
      let token = null, pv = null, pvStatus = null
      const on = async (r) => { const u = r.url(); if (u.includes('/excel/upload') && r.request().method() === 'POST') { const j = await r.json().catch(() => ({})); token = j.data?.uploadToken || j.uploadToken || j.data } if (u.includes('/excel/preview/') && !u.includes('/workbook')) { pvStatus = r.status(); pv = (await r.json().catch(() => ({}))).data } }
      page.on('response', on)
      await page.goto(BASE + '/config/tenant-package', { waitUntil: 'domcontentloaded' }); await sleep(2000)
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }).catch(() => null), nClick(page.locator('button:has-text("导出当前配置"),button:has-text("Export current")').first())])
      if (!dl) throw new Error('导出未触发下载')
      const p = '/tmp/fe-audit-pkg.xlsx'; await dl.saveAs(p)
      await page.locator('input[type=file]').first().setInputFiles(p); await sleep(800)
      await nClick(page.locator('button:has-text("开始上传"),button:has-text("Start upload")').first())
      for (let i = 0; i < 20 && !token; i++) await sleep(500)
      await nClick(page.locator('button:has-text("下一步"),button:has-text("Next")').first()); await sleep(800)
      await nClick(page.locator('button:has-text("拉取预览"),button:has-text("Fetch preview")').first())
      for (let i = 0; i < 24 && !pv; i++) await sleep(500)
      page.off('response', on)
      // 「能用」的判定 = 上传拿到 token + 预览接口 200 返回(total 解析依版本而异,不作硬断言)
      if (!token) throw new Error('上传未拿到 uploadToken')
      if (pvStatus !== 200 || !pv) throw new Error('预览失败 HTTP ' + pvStatus)
      const total = pv?.summary?.total ?? pv?.total ?? pv?.summary?.totalRows
      return 'token✓ 预览 200' + (total != null ? ' total=' + total : '')
    })

    // 注:各配置实体的「新增→真提交」由 --interact 模式逐页覆盖(含队列/模板,即发现
    // ck_resource_queue_type / CSV 默认值非法等 bug 的地方),此处场景聚焦多步操作员主链路。

    await step('触发作业(列表首行)', async () => {
      let ok = false
      const on = (r) => { if (r.url().includes('/jobs/trigger') && r.request().method() === 'POST') ok = r.status() < 300 }
      page.on('response', on)
      await page.goto(BASE + '/jobs/definitions', { waitUntil: 'domcontentloaded' }); await sleep(1800)
      // 触发任意作业即验证链路 —— 用未过滤列表首行(不硬编码 code,避免 seed 差异)
      const row = page.locator('.el-table__row').first()
      if (!(await row.count().catch(() => 0))) throw new Error('作业定义列表无数据可触发')
      await sleep(600) // 等 RowActions 渲染完(避开骨架行)
      // 行操作 = RowActions(根 .row-actions;手动触发 primary 首个 → inline el-button)
      let trg = page.locator('.row-actions').getByRole('button', { name: /手动触发|Trigger/ }).first()
      if (!(await trg.count().catch(() => 0))) {
        // 若被收进「更多」dropdown:点 .row-actions__more 展开再取菜单项
        const more = page.locator('.row-actions__more').first()
        if (await more.count()) { await nClick(more); await sleep(500); trg = page.locator('.el-dropdown-menu__item:visible, [role="menuitem"]:visible').filter({ hasText: /手动触发|Trigger/ }).first() }
      }
      if (!(await trg.count().catch(() => 0))) throw new Error('找不到触发按钮')
      await nClick(trg); await sleep(1000)
      const ta = page.locator('.el-message-box textarea').first(); if (await ta.count()) await ta.fill('{}')
      await nClick(page.locator('.el-message-box__btns button').filter({ hasText: /触发|Trigger|确定/ }).first()); await sleep(2500)
      page.off('response', on)
      if (!ok) throw new Error('触发未成功')
      return '触发成功'
    })

    await step('运维 rerun 失败实例', async () => {
      await page.goto(BASE + '/monitor/job-instances', { waitUntil: 'domcontentloaded' }); await sleep(2200)
      const link = page.locator('.el-table__row').first().locator('a,.cell-link,button').filter({ hasText: /inst-|详情|Detail/ }).first()
      if (!(await link.count().catch(() => 0))) throw new Error('无实例可进详情')
      let s = null; const on = (r) => { if (r.url().includes('/jobs/rerun') && r.request().method() === 'POST') s = r.status() }
      page.on('response', on)
      await nClick(link); await sleep(2500)
      const rr = page.locator('button').filter({ hasText: /重跑|Rerun/ }).first()
      if (!(await rr.count().catch(() => 0))) { page.off('response', on); return 'rerun 按钮不显示(状态不支持,合理)' }
      await nClick(rr); await sleep(1000)
      const cf = page.locator('.el-message-box__btns button,.el-dialog:visible button').filter({ hasText: /确定|确认|Rerun|Confirm/ }).first()
      if (await cf.count()) await nClick(cf); await sleep(2000)
      page.off('response', on)
      if (s && s >= 400) throw new Error('rerun HTTP ' + s)
      return 'rerun HTTP ' + (s || '(无请求)')
    })

    console.log()
    let pass = 0
    for (const s of steps) { console.log((s.ok ? '  ✓ ' : '  ✗ ') + s.name + (s.ok ? '  ' + s.d : '  ← ' + s.why)); if (s.ok) pass++ }
    console.log('  ' + pass + '/' + steps.length + ' 步通过')
  }

  await browser.close()
  console.log('\n════════════ 汇总 ════════════')
  if (realBugs.length === 0) { console.log('✓ 未发现客户可见报错 / 真 bug'); process.exit(0) }
  console.log('✗ 发现 ' + realBugs.length + ' 个真问题:')
  for (const b of realBugs) console.log('  • ' + b.where + ' → ' + b.why)
  process.exit(1)
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(2) })
