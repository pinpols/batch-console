/**
 * 表单 / 对话框测试通用 helpers — 给 *-validation.spec.ts 复用。
 * 见 docs/runbook/fe-qa-c-tier-plan.md §B.1。
 */
import { type Page, type Locator, expect } from '@playwright/test'

/**
 * 打开页面级"新增/新建"对话框,等动画进场完毕。
 * 兼容 EP `el-dialog` 和 `el-drawer`(多数 CRUD 表单 2026-05 后改成抽屉)。
 * @returns 命中的容器 Locator(`.el-dialog` 或 `.el-drawer`)
 */
export async function openDialog(
  page: Page,
  triggerName: string | RegExp,
): Promise<Locator> {
  await page.getByRole('button', { name: triggerName }).first().click()
  // EP dialog/drawer 默认动画 ~300ms
  await page.waitForTimeout(400)
  // 兼容 dialog & drawer。先取可见的那个。
  const candidate = page.locator('.el-dialog:visible, .el-drawer:visible').first()
  await expect(candidate).toBeVisible({ timeout: 3000 })
  return candidate
}

/**
 * 在 dialog 内点提交按钮(默认匹配 保存/创建/确定)。
 * 用 force 跳过 stability(EP dialog wrapper 有 backdrop 滚动锁定抖动)。
 */
export async function submitForm(
  dialog: Locator,
  btnName: string | RegExp = /保存|创建|确定/,
): Promise<void> {
  await dialog.getByRole('button', { name: btnName }).click({ force: true })
}

/**
 * 关闭 dialog(优先点"取消",再回退 ESC)。
 */
export async function cancelDialog(dialog: Locator): Promise<void> {
  const cancel = dialog.getByRole('button', { name: /取消|关闭/ }).first()
  if (await cancel.count()) {
    await cancel.click({ force: true })
  } else {
    await dialog.page().keyboard.press('Escape')
  }
}

/**
 * 全空提交 → 期望被拦截(submit 不发请求 OR 有 required 红字 OR toast warning)。
 * 命中任一兜底信号即通过。
 */
export async function expectRequiredBlocked(dialog: Locator): Promise<void> {
  await submitForm(dialog)
  // 任一信号即可:1) .el-form-item.is-error, 2) .el-message--warning, 3) toast --error
  const sig = dialog.page().locator(
    '.el-form-item.is-error, .el-message--warning, .el-message--error',
  )
  await expect(sig.first()).toBeVisible({ timeout: 2500 })
}

/**
 * 字段超长输入 → 期望被截断或触发 max rule。
 * 通过断言:输入框 value 长度 ≤ max(MaxLength 拒收) OR 出现 is-error 文案。
 */
export async function expectMaxLength(
  dialog: Locator,
  label: string | RegExp,
  max: number,
): Promise<void> {
  const formItem = dialog.locator('.el-form-item').filter({ hasText: label })
  const input = formItem.locator('input,textarea').first()
  const tooLong = 'a'.repeat(max + 1)
  await input.fill(tooLong)
  const value = await input.inputValue()
  if (value.length <= max) {
    // 输入框拒收超长 — 通过
    return
  }
  // 触发提交,期望 rule 报错
  await submitForm(dialog)
  await expect(formItem).toHaveClass(/is-error/, { timeout: 2000 })
}

/**
 * 数字框输字母 → 期望被拒收(input mask)或 submit 时校验失败。
 * el-input-number 渲染为 `type="number"`,playwright fill('abc') 会直接抛错 — 同样视为通过。
 */
export async function expectNumericRejection(
  dialog: Locator,
  label: string | RegExp,
): Promise<void> {
  const formItem = dialog.locator('.el-form-item').filter({ hasText: label })
  const input = formItem.locator('input').first()
  try {
    await input.fill('abc')
  } catch {
    return // type=number 拒接字母,input mask 起效
  }
  const value = await input.inputValue()
  if (!value.includes('abc')) return // input 拒收 — 通过
  await submitForm(dialog)
  await expect(formItem).toHaveClass(/is-error/, { timeout: 2000 })
}

/**
 * 在 form-item 里定位 input/textarea/select 的辅助封装。
 * 多个同名 label 时取 first()。
 */
export function fieldInput(dialog: Locator, label: string | RegExp): Locator {
  return dialog.locator('.el-form-item').filter({ hasText: label }).locator('input,textarea').first()
}

/**
 * 检查 dialog 关闭后再次打开,表单**已 reset**(没有上次输入残留)。
 */
export async function expectFormResetOnReopen(
  page: Page,
  triggerName: string | RegExp,
  label: string | RegExp,
  testValue: string,
): Promise<void> {
  const dialog1 = await openDialog(page, triggerName)
  await fieldInput(dialog1, label).fill(testValue)
  await cancelDialog(dialog1)
  await page.waitForTimeout(200)
  const dialog2 = await openDialog(page, triggerName)
  const value = await fieldInput(dialog2, label).inputValue()
  expect(value, `field "${label}" should reset on reopen`).toBe('')
  await cancelDialog(dialog2)
}

/**
 * 等所有 toast 消失(避免污染下一个 case 的断言)。
 */
export async function waitForToastsToClear(page: Page): Promise<void> {
  await page.locator('.el-message').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
}
